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

import { GroupEntity, UserEntity } from '@backstage/catalog-model';
// import { LdapSearchEntry } from './client';
import {
  defaultGroupTransformer,
  defaultUserTransformer,
  // readLdapGroups,
  readLdapUsers,
  resolveRelations,
} from './read';
import { GroupConfig, UserConfig } from './config';
import { DefaultLdapVendor } from './vendors';
import { SearchEntry } from 'ldapts';

describe('LDAP read functions', () => {
  // const mockVendor: LdapVendor = {
  //   ...DefaultLdapVendor,
  //   decodeStringAttribute: (entry: Entry, name: string) => {
  //     const attr = entry.attributes.find(a => a.type === name);
  //     return attr ? attr.values : [];
  //   },
  // };

  const createMockEntry = (
    data: Record<string, string | string[]>,
  ): SearchEntry => {
    const attributes = Object.entries(data).map(([type, value]) => ({
      type,
      values: Array.isArray(value) ? value : [value],
    }));

    const raw: Record<string, Buffer | Buffer[]> = {};
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        raw[key] = value.map(v => Buffer.from(v));
      } else {
        raw[key] = Buffer.from(value);
      }
    }

    return {
      objectName: (data.dn as string) || '',
      attributes,
      raw,
    };
  };

  describe('defaultUserTransformer', () => {
    const userConfig: UserConfig = {
      dn: 'ou=users,dc=example,dc=com',
      options: { scope: 'sub', filter: '(objectClass=person)' },
      map: {
        rdn: 'uid',
        name: 'uid',
        displayName: 'cn',
        email: 'mail',
        memberOf: 'memberOf',
      },
    };

    it('should transform a basic user entry', async () => {
      const entry = createMockEntry({
        dn: 'uid=john.doe,ou=users,dc=example,dc=com',
        uid: 'john.doe',
        cn: 'John Doe',
        mail: 'john.doe@example.com',
        entryDN: 'uid=john.doe,ou=users,dc=example,dc=com',
        entryUUID: '12345-67890',
      });

      const result = await defaultUserTransformer(
        mockVendor,
        userConfig,
        entry,
      );

      expect(result).toMatchObject({
        apiVersion: 'backstage.io/v1beta1',
        kind: 'User',
        metadata: {
          name: 'john.doe',
          annotations: {
            'backstage.io/ldap-dn': 'uid=john.doe,ou=users,dc=example,dc=com',
            'backstage.io/ldap-rdn': 'john.doe',
            'backstage.io/ldap-uuid': '12345-67890',
          },
        },
        spec: {
          profile: {
            displayName: 'John Doe',
            email: 'john.doe@example.com',
          },
          memberOf: [],
        },
      });
    });

    it('should handle missing optional fields', async () => {
      const entry = createMockEntry({
        dn: 'uid=minimal.user,ou=users,dc=example,dc=com',
        uid: 'minimal.user',
        entryDN: 'uid=minimal.user,ou=users,dc=example,dc=com',
        entryUUID: '99999',
      });

      const result = await defaultUserTransformer(
        mockVendor,
        userConfig,
        entry,
      );

      expect(result).toBeDefined();
      expect(result?.metadata.name).toBe('minimal.user');
      expect(result?.spec.profile).toEqual({});
    });

    it('should throw error for missing required name field', async () => {
      const entry = createMockEntry({
        dn: 'uid=noname,ou=users,dc=example,dc=com',
        cn: 'No Name User',
        mail: 'noname@example.com',
      });

      await expect(
        defaultUserTransformer(mockVendor, userConfig, entry),
      ).rejects.toThrow(
        "User syncing failed: missing 'uid' attribute, consider applying a user filter to skip processing users with incomplete data.",
      );
    });

    it('should apply set values', async () => {
      const configWithSet: UserConfig = {
        ...userConfig,
        set: {
          'metadata.namespace': 'ldap',
          'metadata.labels.source': 'ldap',
        },
      };

      const entry = createMockEntry({
        dn: 'uid=john.doe,ou=users,dc=example,dc=com',
        uid: 'john.doe',
        entryDN: 'uid=john.doe,ou=users,dc=example,dc=com',
        entryUUID: '12345',
      });

      const result = await defaultUserTransformer(
        mockVendor,
        configWithSet,
        entry,
      );

      expect(result?.metadata.namespace).toBe('ldap');
      expect(result?.metadata.labels).toEqual({ source: 'ldap' });
    });
  });

  describe('defaultGroupTransformer', () => {
    const groupConfig: GroupConfig = {
      dn: 'ou=groups,dc=example,dc=com',
      options: { scope: 'sub', filter: '(objectClass=group)' },
      map: {
        rdn: 'cn',
        name: 'cn',
        description: 'description',
        type: 'groupType',
        displayName: 'cn',
        memberOf: 'memberOf',
        members: 'member',
      },
    };

    it('should transform a basic group entry', async () => {
      const entry = createMockEntry({
        dn: 'cn=developers,ou=groups,dc=example,dc=com',
        cn: 'developers',
        description: 'Development Team',
        groupType: 'team',
        entryDN: 'cn=developers,ou=groups,dc=example,dc=com',
        entryUUID: 'group-123',
      });

      const result = await defaultGroupTransformer(
        mockVendor,
        groupConfig,
        entry,
      );

      expect(result).toMatchObject({
        apiVersion: 'backstage.io/v1beta1',
        kind: 'Group',
        metadata: {
          name: 'developers',
          description: 'Development Team',
          annotations: {
            'backstage.io/ldap-dn': 'cn=developers,ou=groups,dc=example,dc=com',
            'backstage.io/ldap-rdn': 'developers',
            'backstage.io/ldap-uuid': 'group-123',
          },
        },
        spec: {
          type: 'team',
          profile: {
            displayName: 'developers',
          },
          children: [],
        },
      });
    });

    it('should handle groups with email and picture', async () => {
      const configWithEmailPicture: GroupConfig = {
        ...groupConfig,
        map: {
          ...groupConfig.map,
          email: 'mail',
          picture: 'thumbnailPhoto',
        },
      };

      const entry = createMockEntry({
        dn: 'cn=admins,ou=groups,dc=example,dc=com',
        cn: 'admins',
        mail: 'admins@example.com',
        thumbnailPhoto: 'https://example.com/admins.jpg',
        entryDN: 'cn=admins,ou=groups,dc=example,dc=com',
        entryUUID: 'admin-group',
      });

      const result = await defaultGroupTransformer(
        mockVendor,
        configWithEmailPicture,
        entry,
      );

      expect(result?.spec.profile).toMatchObject({
        displayName: 'admins',
        email: 'admins@example.com',
        picture: 'https://example.com/admins.jpg',
      });
    });

    it('should throw error for missing required name field', async () => {
      const entry = createMockEntry({
        dn: 'cn=noname,ou=groups,dc=example,dc=com',
        description: 'Group without name',
      });

      await expect(
        defaultGroupTransformer(mockVendor, groupConfig, entry),
      ).rejects.toThrow(
        "Group syncing failed: missing 'cn' attribute, consider applying a group filter to skip processing groups with incomplete data.",
      );
    });
  });

  describe('readLdapUsers', () => {
    const mockClient = {
      getVendor: jest.fn().mockResolvedValue(DefaultLdapVendor),
      searchStreaming: jest.fn(),
    };

    const userConfig: UserConfig = {
      dn: 'ou=users,dc=example,dc=com',
      options: { scope: 'sub', filter: '(objectClass=person)' },
      map: {
        rdn: 'uid',
        name: 'uid',
        displayName: 'cn',
        email: 'mail',
        memberOf: 'memberOf',
      },
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should read users and their group memberships', async () => {
      const mockEntries = [
        createMockEntry({
          dn: 'uid=user1,ou=users,dc=example,dc=com',
          uid: 'user1',
          cn: 'User One',
          memberOf: [
            'cn=team1,ou=groups,dc=example,dc=com',
            'cn=team2,ou=groups,dc=example,dc=com',
          ],
          entryDN: 'uid=user1,ou=users,dc=example,dc=com',
          entryUUID: 'user1-uuid',
        }),
        createMockEntry({
          dn: 'uid=user2,ou=users,dc=example,dc=com',
          uid: 'user2',
          cn: 'User Two',
          memberOf: ['cn=team1,ou=groups,dc=example,dc=com'],
          entryDN: 'uid=user2,ou=users,dc=example,dc=com',
          entryUUID: 'user2-uuid',
        }),
      ];

      mockClient.searchStreaming.mockImplementation(
        async (dn, options, callback) => {
          for (const entry of mockEntries) {
            await callback(entry);
          }
        },
      );

      const result = await readLdapUsers(
        mockClient as any,
        [userConfig],
        undefined,
      );

      expect(result.users).toHaveLength(2);
      expect(result.users[0].metadata.name).toBe('user1');
      expect(result.users[1].metadata.name).toBe('user2');

      expect(
        result.userMemberOf.get('uid=user1,ou=users,dc=example,dc=com'),
      ).toEqual(
        new Set([
          'cn=team1,ou=groups,dc=example,dc=com',
          'cn=team2,ou=groups,dc=example,dc=com',
        ]),
      );
      expect(
        result.userMemberOf.get('uid=user2,ou=users,dc=example,dc=com'),
      ).toEqual(new Set(['cn=team1,ou=groups,dc=example,dc=com']));
    });

    it('should handle custom transformer', async () => {
      const customTransformer = jest.fn().mockResolvedValue({
        apiVersion: 'backstage.io/v1beta1',
        kind: 'User',
        metadata: { name: 'custom-user' },
        spec: { memberOf: [] },
      });

      const mockEntry = createMockEntry({
        dn: 'uid=user1,ou=users,dc=example,dc=com',
        uid: 'user1',
        entryDN: 'uid=user1,ou=users,dc=example,dc=com',
        entryUUID: 'user1-uuid',
      });

      mockClient.searchStreaming.mockImplementation(
        async (dn, options, callback) => {
          await callback(mockEntry);
        },
      );

      const result = await readLdapUsers(
        mockClient as any,
        [userConfig],
        undefined,
        { transformer: customTransformer },
      );

      expect(customTransformer).toHaveBeenCalledWith(
        expect.any(Object),
        userConfig,
        mockEntry,
      );
      expect(result.users[0].metadata.name).toBe('custom-user');
    });

    it('should skip entries when transformer returns undefined', async () => {
      const filteringTransformer = jest
        .fn()
        .mockImplementation(async (vendor, config, entry) => {
          if (
            entry.attributes.find(a => a.type === 'uid')?.values[0] ===
            'skip-me'
          ) {
            return undefined;
          }
          return defaultUserTransformer(vendor, config, entry);
        });

      const mockEntries = [
        createMockEntry({
          dn: 'uid=keep-me,ou=users,dc=example,dc=com',
          uid: 'keep-me',
          entryDN: 'uid=keep-me,ou=users,dc=example,dc=com',
          entryUUID: 'keep-uuid',
        }),
        createMockEntry({
          dn: 'uid=skip-me,ou=users,dc=example,dc=com',
          uid: 'skip-me',
          entryDN: 'uid=skip-me,ou=users,dc=example,dc=com',
          entryUUID: 'skip-uuid',
        }),
      ];

      mockClient.searchStreaming.mockImplementation(
        async (dn, options, callback) => {
          for (const entry of mockEntries) {
            await callback(entry);
          }
        },
      );

      const result = await readLdapUsers(
        mockClient as any,
        [userConfig],
        undefined,
        { transformer: filteringTransformer },
      );

      expect(result.users).toHaveLength(1);
      expect(result.users[0].metadata.name).toBe('keep-me');
    });
  });

  describe('resolveRelations', () => {
    it('should resolve user memberships to groups', () => {
      const users: UserEntity[] = [
        {
          apiVersion: 'backstage.io/v1beta1',
          kind: 'User',
          metadata: {
            name: 'user1',
            annotations: {
              'backstage.io/ldap-dn': 'uid=user1,ou=users,dc=example,dc=com',
              'backstage.io/ldap-uuid': 'user1-uuid',
            },
          },
          spec: { memberOf: [] },
        },
      ];

      const groups: GroupEntity[] = [
        {
          apiVersion: 'backstage.io/v1beta1',
          kind: 'Group',
          metadata: {
            name: 'team1',
            annotations: {
              'backstage.io/ldap-dn': 'cn=team1,ou=groups,dc=example,dc=com',
              'backstage.io/ldap-uuid': 'team1-uuid',
            },
          },
          spec: { type: 'team', children: [] },
        },
      ];

      const userMemberOf = new Map([
        [
          'uid=user1,ou=users,dc=example,dc=com',
          new Set(['cn=team1,ou=groups,dc=example,dc=com']),
        ],
      ]);

      resolveRelations(groups, users, userMemberOf, new Map(), new Map());

      expect(users[0].spec.memberOf).toEqual(['group:default/team1']);
    });

    it('should resolve group hierarchies', () => {
      const groups: GroupEntity[] = [
        {
          apiVersion: 'backstage.io/v1beta1',
          kind: 'Group',
          metadata: {
            name: 'parent',
            annotations: {
              'backstage.io/ldap-dn': 'cn=parent,ou=groups,dc=example,dc=com',
              'backstage.io/ldap-uuid': 'parent-uuid',
            },
          },
          spec: { type: 'team', children: [] },
        },
        {
          apiVersion: 'backstage.io/v1beta1',
          kind: 'Group',
          metadata: {
            name: 'child',
            annotations: {
              'backstage.io/ldap-dn': 'cn=child,ou=groups,dc=example,dc=com',
              'backstage.io/ldap-uuid': 'child-uuid',
            },
          },
          spec: { type: 'team', children: [] },
        },
      ];

      const groupMemberOf = new Map([
        [
          'cn=child,ou=groups,dc=example,dc=com',
          new Set(['cn=parent,ou=groups,dc=example,dc=com']),
        ],
      ]);

      resolveRelations(groups, [], new Map(), groupMemberOf, new Map());

      expect(groups[1].spec.parent).toBe('group:default/parent');
      expect(groups[0].spec.children).toEqual(['group:default/child']);
    });

    it('should handle case-insensitive DN matching', () => {
      const users: UserEntity[] = [
        {
          apiVersion: 'backstage.io/v1beta1',
          kind: 'User',
          metadata: {
            name: 'user1',
            annotations: {
              'backstage.io/ldap-dn': 'UID=User1,OU=Users,DC=Example,DC=Com',
              'backstage.io/ldap-uuid': 'user1-uuid',
            },
          },
          spec: { memberOf: [] },
        },
      ];

      const groups: GroupEntity[] = [
        {
          apiVersion: 'backstage.io/v1beta1',
          kind: 'Group',
          metadata: {
            name: 'team1',
            annotations: {
              'backstage.io/ldap-dn': 'CN=Team1,OU=Groups,DC=Example,DC=Com',
              'backstage.io/ldap-uuid': 'team1-uuid',
            },
          },
          spec: { type: 'team', children: [] },
        },
      ];

      // Note the lowercase DN in the map
      const userMemberOf = new Map([
        [
          'uid=user1,ou=users,dc=example,dc=com',
          new Set(['cn=team1,ou=groups,dc=example,dc=com']),
        ],
      ]);

      resolveRelations(groups, users, userMemberOf, new Map(), new Map());

      expect(users[0].spec.memberOf).toEqual(['group:default/team1']);
    });

    it('should resolve by UUID when DN is not found', () => {
      const users: UserEntity[] = [
        {
          apiVersion: 'backstage.io/v1beta1',
          kind: 'User',
          metadata: {
            name: 'user1',
            annotations: {
              'backstage.io/ldap-dn': 'uid=user1,ou=users,dc=example,dc=com',
              'backstage.io/ldap-uuid': 'user1-uuid',
            },
          },
          spec: { memberOf: [] },
        },
      ];

      const groups: GroupEntity[] = [
        {
          apiVersion: 'backstage.io/v1beta1',
          kind: 'Group',
          metadata: {
            name: 'team1',
            annotations: {
              'backstage.io/ldap-dn': 'cn=team1,ou=groups,dc=example,dc=com',
              'backstage.io/ldap-uuid': 'team1-uuid',
            },
          },
          spec: { type: 'team', children: [] },
        },
      ];

      // Use UUID instead of DN
      const userMemberOf = new Map([['user1-uuid', new Set(['team1-uuid'])]]);

      resolveRelations(groups, users, userMemberOf, new Map(), new Map());

      expect(users[0].spec.memberOf).toEqual(['group:default/team1']);
    });
  });
});
