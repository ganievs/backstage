/*
 * Copyright 2026 The Backstage Authors
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

import {
  KubernetesCustomResourceRenderer,
  KubernetesCustomResourceRenderersApi,
} from './types';

/**
 * Default implementation of {@link KubernetesCustomResourceRenderersApi}. When
 * several renderers match, the first one in the list is used.
 *
 * @alpha
 */
export class DefaultKubernetesCustomResourceRenderersApi
  implements KubernetesCustomResourceRenderersApi
{
  private readonly renderers: KubernetesCustomResourceRenderer[];

  private constructor(renderers: KubernetesCustomResourceRenderer[]) {
    this.renderers = renderers;
  }

  /** Creates an instance that uses the given renderers. */
  static create(options?: { renderers: KubernetesCustomResourceRenderer[] }) {
    return new DefaultKubernetesCustomResourceRenderersApi(
      options?.renderers ?? [],
    );
  }

  /** {@inheritDoc KubernetesCustomResourceRenderersApi.getRenderer} */
  getRenderer(options: {
    group?: string;
    kind: string;
  }): KubernetesCustomResourceRenderer | undefined {
    return this.renderers.find(
      r =>
        r.kind === options.kind &&
        (options.group === undefined || r.group === options.group),
    );
  }
}
