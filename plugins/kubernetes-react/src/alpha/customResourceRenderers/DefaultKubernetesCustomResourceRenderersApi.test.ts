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

import { DefaultKubernetesCustomResourceRenderersApi } from './DefaultKubernetesCustomResourceRenderersApi';
import { KubernetesCustomResourceRenderer } from './types';

const renderer = (
  group: string,
  kind: string,
): KubernetesCustomResourceRenderer => ({
  group,
  kind,
  component: () => null as any,
});

describe('DefaultKubernetesCustomResourceRenderersApi', () => {
  it('matches renderers by group and kind', () => {
    const virtualService = renderer('networking.istio.io', 'VirtualService');
    const first = renderer('example.com', 'Widget');
    const second = renderer('example.com', 'Widget');
    const other = renderer('other.example.com', 'Widget');
    const api = DefaultKubernetesCustomResourceRenderersApi.create({
      renderers: [virtualService, first, second, other],
    });

    expect(
      api.getRenderer({ group: 'networking.istio.io', kind: 'VirtualService' }),
    ).toBe(virtualService);
    expect(
      api.getRenderer({ group: 'other.example.com', kind: 'Widget' }),
    ).toBe(other);
    // The first matching renderer wins
    expect(api.getRenderer({ group: 'example.com', kind: 'Widget' })).toBe(
      first,
    );
    // Kind alone when the group is unknown
    expect(api.getRenderer({ kind: 'Widget' })).toBe(first);

    expect(
      api.getRenderer({ group: 'networking.istio.io', kind: 'Gateway' }),
    ).toBeUndefined();
    expect(
      api.getRenderer({ group: '', kind: 'VirtualService' }),
    ).toBeUndefined();
    expect(
      DefaultKubernetesCustomResourceRenderersApi.create().getRenderer({
        kind: 'Widget',
      }),
    ).toBeUndefined();
  });
});
