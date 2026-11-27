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

import { JSX } from 'react';
import {
  createExtensionBlueprint,
  createExtensionDataRef,
  ExtensionBoundary,
} from '@backstage/frontend-plugin-api';
import {
  KubernetesCustomResourceRenderer,
  KubernetesCustomResourceRendererProps,
} from './types';

const rendererDataRef =
  createExtensionDataRef<KubernetesCustomResourceRenderer>().with({
    id: 'kubernetes.custom-resource-renderer',
  });

/**
 * Parameters for {@link KubernetesCustomResourceRendererBlueprint}.
 *
 * @alpha
 */
export interface KubernetesCustomResourceRendererBlueprintParams {
  /** The API group of the custom resource, for example `networking.istio.io`. */
  group: string;
  /** The kind of the custom resource, for example `VirtualService`. */
  kind: string;
  /** Async loader that returns the component rendering the resources. */
  loader: () => Promise<
    (props: KubernetesCustomResourceRendererProps) => JSX.Element
  >;
}

/**
 * Creates an extension that renders the Kubernetes custom resources of one
 * API group and kind, replacing the default view for them.
 *
 * @alpha
 */
export const KubernetesCustomResourceRendererBlueprint =
  createExtensionBlueprint({
    kind: 'kubernetes-custom-resource-renderer',
    attachTo: {
      id: 'api:kubernetes/custom-resource-renderers',
      input: 'renderers',
    },
    output: [rendererDataRef],
    dataRefs: {
      renderer: rendererDataRef,
    },
    *factory(
      params: KubernetesCustomResourceRendererBlueprintParams,
      { node },
    ) {
      yield rendererDataRef({
        group: params.group,
        kind: params.kind,
        component: ExtensionBoundary.lazyComponent(node, params.loader),
      });
    },
  });
