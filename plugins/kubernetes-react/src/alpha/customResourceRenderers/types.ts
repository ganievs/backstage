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
import { createApiRef } from '@backstage/core-plugin-api';

/**
 * Props passed to a custom resource renderer component.
 *
 * @alpha
 */
export interface KubernetesCustomResourceRendererProps {
  /** The API group the renderer was registered for, for example `networking.istio.io`. */
  group: string;
  /** The kind the renderer was registered for, for example `VirtualService`. */
  kind: string;
  /** All custom resources of this group and kind in the current cluster. */
  resources: any[];
}

/**
 * A component that renders all custom resources of one API group and kind.
 *
 * @alpha
 */
export interface KubernetesCustomResourceRenderer {
  /** The API group to match, for example `networking.istio.io`. */
  group: string;
  /** The kind to match, for example `VirtualService`. */
  kind: string;
  /** The component that renders the matching custom resources. */
  component: (props: KubernetesCustomResourceRendererProps) => JSX.Element;
}

/**
 * Provides the renderers used to display custom resources in the Kubernetes
 * plugin.
 *
 * @alpha
 */
export interface KubernetesCustomResourceRenderersApi {
  /**
   * Returns the renderer for the given API group and kind, if one is
   * registered. When `group` is not provided, the renderer is matched by kind
   * alone.
   */
  getRenderer(options: {
    group?: string;
    kind: string;
  }): KubernetesCustomResourceRenderer | undefined;
}

/**
 * API reference for {@link KubernetesCustomResourceRenderersApi}.
 *
 * @alpha
 */
export const kubernetesCustomResourceRenderersApiRef =
  createApiRef<KubernetesCustomResourceRenderersApi>({
    id: 'plugin.kubernetes.custom-resource-renderers',
  });
