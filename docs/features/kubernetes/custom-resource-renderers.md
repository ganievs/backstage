---
id: custom-resource-renderers
title: Custom resource renderers
description: Showing your own views for Kubernetes custom resources in the Kubernetes plugin
---

The Kubernetes plugin shows the [custom resources](./configuration.md#customresources-optional)
that you configure it to fetch. By default, each custom resource is shown with a
generic view that lists its name and status, and Argo Rollouts (`Rollout` in the
`argoproj.io` group) get a dedicated view.

You can replace the view for any custom resource with your own component, a
_custom resource renderer_. A renderer is registered for one API group and kind,
for example `VirtualService` in the `networking.istio.io` group. It receives all
the custom resources of that group and kind in a cluster and decides how to show
them.

When a renderer is registered for a group and kind, it is used instead of the
built-in view, including the Argo Rollouts view. Resources that the backend
returns without an `apiVersion` are matched by kind alone.

:::note
This feature is in alpha. Its APIs are exported from
`@backstage/plugin-kubernetes-react/alpha`.
:::

## Write a renderer component

A renderer is a React component that receives these props:

- `group`: the API group the renderer was registered for.
- `kind`: the kind the renderer was registered for.
- `resources`: the raw custom resource objects of that group and kind in the
  cluster.

```tsx title="src/components/VirtualService.tsx"
import { StructuredMetadataTable } from '@backstage/core-components';
import { KubernetesCustomResourceRendererProps } from '@backstage/plugin-kubernetes-react/alpha';

export const VirtualServiceAccordions = ({
  resources,
}: KubernetesCustomResourceRendererProps) => (
  <>
    {resources.map(resource => (
      <StructuredMetadataTable
        key={resource.metadata.name}
        metadata={{
          name: resource.metadata.name,
          hosts: resource.spec?.hosts,
        }}
      />
    ))}
  </>
);
```

You can build the view from the components that
`@backstage/plugin-kubernetes-react` exports, such as
`KubernetesStructuredMetadataTableDrawer`, to match the look of the built-in
views.

## Register a renderer in the new frontend system

Create the renderer with `KubernetesCustomResourceRendererBlueprint` and install
it through a frontend module for the `kubernetes` plugin. The component is
loaded lazily the first time it is shown.

```tsx title="src/modules/kubernetesRenderers.ts"
import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { KubernetesCustomResourceRendererBlueprint } from '@backstage/plugin-kubernetes-react/alpha';

export const kubernetesRenderersModule = createFrontendModule({
  pluginId: 'kubernetes',
  extensions: [
    KubernetesCustomResourceRendererBlueprint.make({
      name: 'istio-virtual-service',
      params: {
        group: 'networking.istio.io',
        kind: 'VirtualService',
        loader: () =>
          import('../components/VirtualService').then(
            m => m.VirtualServiceAccordions,
          ),
      },
    }),
  ],
});
```

Then add the module to the `features` of your app:

```tsx title="packages/app/src/App.tsx"
import { createApp } from '@backstage/frontend-defaults';
import { kubernetesRenderersModule } from './modules/kubernetesRenderers';

const app = createApp({
  features: [kubernetesRenderersModule],
});
```

Each renderer extension is attached to the
`api:kubernetes/custom-resource-renderers` extension. If you register more than
one renderer for the same group and kind, the first one is used.

## Register a renderer in the old frontend system

In the old frontend system, provide the renderers API yourself in your app's
`packages/app/src/apis.ts`:

```ts title="packages/app/src/apis.ts"
import { createApiFactory } from '@backstage/core-plugin-api';
import {
  DefaultKubernetesCustomResourceRenderersApi,
  kubernetesCustomResourceRenderersApiRef,
} from '@backstage/plugin-kubernetes-react/alpha';
import { VirtualServiceAccordions } from './components/VirtualService';

export const apis = [
  // ...other APIs
  createApiFactory({
    api: kubernetesCustomResourceRenderersApiRef,
    deps: {},
    factory: () =>
      DefaultKubernetesCustomResourceRenderersApi.create({
        renderers: [
          {
            group: 'networking.istio.io',
            kind: 'VirtualService',
            component: VirtualServiceAccordions,
          },
        ],
      }),
  }),
];
```
