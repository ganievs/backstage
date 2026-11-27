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

import { ReactNode, useContext } from 'react';
import lodash from 'lodash';
import { useApiHolder } from '@backstage/core-plugin-api';
import { DefaultCustomResourceAccordions } from './DefaultCustomResource';
import { builtInRenderers } from './builtInRenderers';
import { GroupedResponsesContext } from '../../hooks';
import { kubernetesCustomResourceRenderersApiRef } from '../../alpha/customResourceRenderers/types';

/**
 *
 *
 * @public
 */
export interface CustomResourcesProps {
  children?: ReactNode;
}

// The API group of a resource: '' for the core group (e.g. 'v1'), and
// undefined when the resource has no apiVersion.
const getGroup = (resource: any): string | undefined => {
  const apiVersion: unknown = resource?.apiVersion;
  if (typeof apiVersion !== 'string') {
    return undefined;
  }
  const slash = apiVersion.indexOf('/');
  return slash === -1 ? '' : apiVersion.slice(0, slash);
};

/**
 *
 *
 * @public
 */
export const CustomResources = ({}: CustomResourcesProps) => {
  const groupedResponses = useContext(GroupedResponsesContext);
  const renderersApi = useApiHolder().get(
    kubernetesCustomResourceRenderersApiRef,
  );
  const groups = lodash.groupBy(
    groupedResponses.customResources,
    resource => `${getGroup(resource)}/${resource.kind}`,
  );

  return (
    <>
      {Object.entries(groups).map(([key, resources]) => {
        const group = getGroup(resources[0]);
        const kind: string = resources[0].kind;
        const renderer =
          renderersApi?.getRenderer({ group, kind }) ??
          builtInRenderers.getRenderer({ group, kind });
        if (renderer) {
          const Renderer = renderer.component;
          return (
            <Renderer
              key={key}
              group={renderer.group}
              kind={renderer.kind}
              resources={resources}
            />
          );
        }
        return (
          <DefaultCustomResourceAccordions
            key={key}
            customResources={resources}
            customResourceName={kind}
          />
        );
      })}
    </>
  );
};
