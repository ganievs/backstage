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

import { ReactNode } from 'react';
import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/test-utils';
import { kubernetesProviders } from '../../hooks/test-utils';
import rollout from './ArgoRollouts/__fixtures__/rollout.json';
import groupedResources from './ArgoRollouts/__fixtures__/grouped-resources.json';
import analysisRun from './__fixtures__/analysis-run.json';
import { CustomResources } from './CustomResources';
import { DefaultKubernetesCustomResourceRenderersApi } from '../../alpha/customResourceRenderers/DefaultKubernetesCustomResourceRenderersApi';
import {
  KubernetesCustomResourceRendererProps,
  kubernetesCustomResourceRenderersApiRef,
} from '../../alpha/customResourceRenderers/types';

const renderCustomResources = (
  customResources: any[],
  renderers?: DefaultKubernetesCustomResourceRenderersApi,
) => {
  const wrapper = kubernetesProviders(
    { ...groupedResources, customResources },
    new Set([]),
  );
  const withApis = (node: ReactNode) =>
    renderers ? (
      <TestApiProvider
        apis={[[kubernetesCustomResourceRenderersApiRef, renderers]]}
      >
        {node}
      </TestApiProvider>
    ) : (
      node
    );
  return renderInTestApp(withApis(wrapper(<CustomResources />)));
};

const CustomRenderer = ({
  group,
  kind,
  resources,
}: KubernetesCustomResourceRendererProps) => (
  <span>
    custom {group}/{kind}: {resources.map(r => r.metadata.name).join(',')}
  </span>
);

describe('CustomResources', () => {
  it('renders Argo Rollouts with the built-in view, with or without apiVersion', async () => {
    const { apiVersion: _, ...rolloutWithoutApiVersion } = rollout;

    await renderCustomResources([rollout, rolloutWithoutApiVersion]);

    // Only the Argo Rollout view renders the pod summary
    expect(screen.getAllByText('No pods with errors')).toHaveLength(2);
    expect(screen.getAllByText('2 pods')).toHaveLength(2);
  });

  it('renders unknown kinds with the generic view and prefers registered renderers', async () => {
    await renderCustomResources(
      [rollout, analysisRun],
      DefaultKubernetesCustomResourceRenderersApi.create({
        renderers: [
          { group: 'argoproj.io', kind: 'Rollout', component: CustomRenderer },
        ],
      }),
    );

    expect(
      screen.getByText('custom argoproj.io/Rollout: dice-roller'),
    ).toBeInTheDocument();
    expect(screen.queryByText('No pods with errors')).not.toBeInTheDocument();
    expect(screen.getByText('dice-roller-546c476497-4-1')).toBeInTheDocument();
    expect(screen.getByText('AnalysisRun')).toBeInTheDocument();
  });

  it('keeps the same kind from different groups apart without a registered API', async () => {
    const otherRollout = {
      apiVersion: 'example.com/v1',
      kind: 'Rollout',
      metadata: { name: 'other-rollout', namespace: 'default' },
    };

    await renderCustomResources([rollout, otherRollout]);

    expect(screen.getAllByText('No pods with errors')).toHaveLength(1);
    expect(screen.getByText('dice-roller')).toBeInTheDocument();
    expect(screen.getByText('other-rollout')).toBeInTheDocument();
  });
});
