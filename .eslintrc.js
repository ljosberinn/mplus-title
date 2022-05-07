const { createConfig } = require("eslint-config-galex/dist/createConfig");
const {
  createTypeScriptOverride,
} = require("eslint-config-galex/dist/overrides/typescript");
const { getDependencies } = require("eslint-config-galex/dist/getDependencies");
const {
  createRemixRunOverride,
} = require("eslint-config-galex/dist/overrides/react");

const deps = getDependencies();

const { files } = createRemixRunOverride(deps);

const tsOverride = createTypeScriptOverride({
  ...deps,
  files,
  rules: {
    "@typescript-eslint/no-throw-literal": "off",
  },
});

module.exports = createConfig({
  overrides: [tsOverride],
});
