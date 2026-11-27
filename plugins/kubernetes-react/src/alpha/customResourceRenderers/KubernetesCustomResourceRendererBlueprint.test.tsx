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
  createExtensionTester,
  renderInTestApp,
} from '@backstage/frontend-test-utils';
import { screen } from '@testing-library/react';
import { KubernetesCustomResourceRendererBlueprint } from './KubernetesCustomResourceRendererBlueprint';

describe('KubernetesCustomResourceRendererBlueprint', () => {
  it('emits a renderer with a lazy component', async () => {
    const extension = KubernetesCustomResourceRendererBlueprint.make({
      name: 'test',
      params: {
        group: 'networking.istio.io',
        kind: 'VirtualService',
        loader: async () => props =>
          (
            <span>
              {props.kind}: {props.resources.map(r => r.name).join(',')}
            </span>
          ),
      },
    });

    expect(extension).toMatchObject({
      kind: 'kubernetes-custom-resource-renderer',
      name: 'test',
      attachTo: {
        id: 'api:kubernetes/custom-resource-renderers',
        input: 'renderers',
      },
    });

    const renderer = createExtensionTester(extension).get(
      KubernetesCustomResourceRendererBlueprint.dataRefs.renderer,
    );
    expect(renderer.group).toBe('networking.istio.io');
    expect(renderer.kind).toBe('VirtualService');

    const Component = renderer.component;
    await renderInTestApp(
      <Component
        group="networking.istio.io"
        kind="VirtualService"
        resources={[{ name: 'a' }, { name: 'b' }]}
      />,
    );

    expect(await screen.findByText('VirtualService: a,b')).toBeInTheDocument();
  });
});
