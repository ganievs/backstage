/*
 * Copyright 2020 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ForwardedError } from '@backstage/errors';
import { readFile } from 'fs/promises';
// import ldap, { Client, SearchEntry, SearchOptions } from 'ldapjs';
import { Client, SearchOptions, Entry } from 'ldapts';
import tlsLib from 'tls';
import { BindConfig, TLSConfig } from './config';
import {
  AEDirVendor,
  ActiveDirectoryVendor,
  DefaultLdapVendor,
  // GoogleLdapVendor,
  LLDAPVendor,
  FreeIpaVendor,
  LdapVendor,
} from './vendors';
import { LoggerService } from '@backstage/backend-plugin-api';

/**
 * Basic wrapper for the `ldapjs` library.
 *
 * Helps out with promisifying calls, paging, binding etc.
 *
 * @public
 */
export class LdapClient {
  private vendor: Promise<LdapVendor> | undefined;

  static async create(
    logger: LoggerService,
    target: string,
    bind?: BindConfig,
    tls?: TLSConfig,
  ): Promise<LdapClient> {
    let secureContext;
    if (tls && tls.certs && tls.keys) {
      const cert = await readFile(tls.certs, 'utf-8');
      const key = await readFile(tls.keys, 'utf-8');
      secureContext = tlsLib.createSecureContext({
        cert: cert,
        key: key,
      });
    }

    const client = new Client({
      url: target,
      tlsOptions: {
        secureContext,
        rejectUnauthorized: tls?.rejectUnauthorized,
      },
    });

    if (bind) {
      try {
        const { dn, secret } = bind;
        await client.bind(dn, secret);
      } catch (err) {
        throw new Error(`LDAP bind failed for ${bind.dn}, ${err}`);
      }
    }

    return new LdapClient(client, logger);
  }

  constructor(
    private readonly client: Client,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Performs an LDAP search operation.
   *
   * @param dn - The fully qualified base DN to search within
   * @param options - The search options
   */
  async search(dn: string, options: SearchOptions): Promise<Entry[]> {
    try {
      const output: Entry[] = [];

      const logInterval = setInterval(() => {
        this.logger.debug(`Read ${output.length} LDAP entries so far...`);
      }, 5000);

      try {
        const result = await this.client.search(dn, options);
        for (const entry of result.searchEntries) {
          output.push(entry);
        }
        return output;
      } finally {
        clearInterval(logInterval);
      }
    } catch (e) {
      throw new ForwardedError(`LDAP search at DN "${dn}" failed`, e);
    }
  }

  /**
   * Performs an LDAP search operation, calls a function on each entry to limit memory usage
   *
   * @param dn - The fully qualified base DN to search within
   * @param options - The search options
   * @param f - The callback to call on each search entry
   */
  async searchStreaming(
    dn: string,
    options: SearchOptions,
    f: (entry: any) => Promise<void> | void,
  ): Promise<void> {
    try {
      const paginator = this.client.searchPaginated(dn, {
        ...options,
      });

      const promises: Promise<void>[] = [];

      for await (const searchResult of paginator) {
        // Process all entries from this page
        for (const entry of searchResult.searchEntries) {
          const result = f(entry);
          if (result instanceof Promise) {
            promises.push(result);
          }
        }

        // Wait for all promises from this page before moving to next
        if (promises.length > 0) {
          await Promise.all(promises);
          promises.length = 0; // Clear array for next page
        }
      }
    } catch (e) {
      throw new ForwardedError(`LDAP search at DN "${dn}" failed`, e);
    }
  }

  /**
   * Get the Server Vendor.
   * Currently only detects Microsoft Active Directory Servers.
   *
   * @see https://ldapwiki.com/wiki/Determine%20LDAP%20Server%20Vendor
   */
  async getVendor(): Promise<LdapVendor> {
    if (this.vendor) {
      return this.vendor;
    }
    // const clientHost = this.client?.host || '';
    this.vendor = this.getRootDSE()
      .then(root => {
        if (root && root.forestFunctionality) {
          return ActiveDirectoryVendor;
        } else if (root && root.ipaDomainLevel) {
          return FreeIpaVendor;
        } else if (root && 'aeRoot' in root) {
          return AEDirVendor;
          // } else if (clientHost === 'ldap.google.com') {
          //   return GoogleLdapVendor;
        } else if (root && root.vendorName?.toString() === 'LLDAP') {
          return LLDAPVendor;
        }
        return DefaultLdapVendor;
      })
      .catch(err => {
        this.vendor = undefined;
        throw err;
      });
    return this.vendor;
  }

  /**
   * Get the Root DSE.
   *
   * @see https://ldapwiki.com/wiki/RootDSE
   */
  async getRootDSE(): Promise<Entry | undefined> {
    const result = await this.search('', {
      scope: 'base',
      filter: '(objectclass=*)',
    } as SearchOptions);
    if (result && result.length === 1) {
      return result[0];
    }
    return undefined;
  }
}
