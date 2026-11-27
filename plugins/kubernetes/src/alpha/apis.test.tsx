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

import { renderTestApp } from '@backstage/frontend-test-utils';
import {
  AppRootElementBlueprint,
  createFrontendModule,
  useApi,
} from '@backstage/frontend-plugin-api';
import {
  KubernetesCustomResourceRendererBlueprint,
  kubernetesCustomResourceRenderersApiRef,
} from '@backstage/plugin-kubernetes-react/alpha';
import { screen } from '@testing-library/react';
import kubernetesPlugin from './plugin';

describe('kubernetesCustomResourceRenderersApi', () => {
  it('collects renderers contributed by modules', async () => {
    function Consumer() {
      const api = useApi(kubernetesCustomResourceRenderersApiRef);
      const renderer = api.getRenderer({
        group: 'networking.istio.io',
        kind: 'VirtualService',
      });
      if (!renderer) {
        return <span>no renderer</span>;
      }
      expect(api.getRenderer({ kind: 'VirtualService' })).toBe(renderer);
      expect(
        api.getRenderer({ group: 'example.com', kind: 'VirtualService' }),
      ).toBeUndefined();
      const Renderer = renderer.component;
      return (
        <Renderer
          group={renderer.group}
          kind={renderer.kind}
          resources={[{ metadata: { name: 'dice-roller' } }]}
        />
      );
    }

    renderTestApp({
      extensions: [
        AppRootElementBlueprint.make({
          name: 'custom-resource-renderers-test',
          params: { element: <Consumer /> },
        }),
      ],
      features: [
        kubernetesPlugin,
        createFrontendModule({
          pluginId: 'kubernetes',
          extensions: [
            KubernetesCustomResourceRendererBlueprint.make({
              name: 'istio-virtual-service',
              params: {
                group: 'networking.istio.io',
                kind: 'VirtualService',
                loader: async () => props =>
                  (
                    <span>
                      {props.group}/{props.kind}:{' '}
                      {props.resources.map(r => r.metadata.name).join(',')}
                    </span>
                  ),
              },
            }),
          ],
        }),
      ],
    });

    expect(
      await screen.findByText(
        'networking.istio.io/VirtualService: dice-roller',
      ),
    ).toBeInTheDocument();
  });
});
