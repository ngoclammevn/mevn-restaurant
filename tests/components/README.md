# Vue component regressions

These tests run real Vue lifecycle and render behavior through a custom host renderer, without a browser or DOM package. Use the explicit client-transform environment so Vue SFCs compile their client render functions instead of SSR functions:

```sh
rtk proxy npx vitest run tests/components --environment ./tests/helpers/vue-host-environment.js --configLoader runner --cache=false
```

They cover committed close/reopen results when refresh fails, copying only a fresh closure snapshot, Slack delivery after an ancillary refresh failure, and in-flight state reset across menu/account switches. `npm run test:unit` continues to run the separate `tests/unit` directory.
