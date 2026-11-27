---
'@backstage/plugin-kubernetes-react': patch
---

Added support for showing your own views for Kubernetes custom resources. Register a renderer component for an API group and kind with the new `KubernetesCustomResourceRendererBlueprint`, or in the old frontend system by providing `kubernetesCustomResourceRenderersApiRef` with `DefaultKubernetesCustomResourceRenderersApi`. Both are exported from `@backstage/plugin-kubernetes-react/alpha`. See the [Custom resource renderers](https://backstage.io/docs/features/kubernetes/custom-resource-renderers) documentation for details.

Custom resources are now grouped by API group and kind rather than by kind alone. Resources of a `Rollout` kind that are not in the `argoproj.io` group are now shown with the generic custom resource view instead of the Argo Rollouts view.
