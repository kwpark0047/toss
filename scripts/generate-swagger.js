#!/usr/bin/env node
/**
 * Swagger Spec Generator CLI
 *
 * Generates static OpenAPI spec file for CI/CD deployment
 * Usage: node scripts/generate-swagger.js [output-file]
 */

const fs = require('fs');
const path = require('path');

// Add project root to require path
require('module').Module._initPaths();
process.chdir(path.join(__dirname, '..'));

// Load the swagger module
const { buildSwaggerSpec } = require('../docs/swagger');

const outputFile = process.argv[2] || path.join(__dirname, '../docs/api-spec.json');

try {
  const spec = buildSwaggerSpec();

  // Write JSON spec
  fs.writeFileSync(outputFile, JSON.stringify(spec, null, 2));

  // Also write YAML for readability
  const yaml = require('js-yaml');
  const yamlOutput = outputFile.replace('.json', '.yaml');
  fs.writeFileSync(yamlOutput, yaml.dump(spec, { lineWidth: 120 }));

  console.log(`✅ Swagger spec generated:`);
  console.log(`   JSON: ${outputFile}`);
  console.log(`   YAML: ${yamlOutput}`);
  console.log(`   Endpoints: ${Object.keys(spec.paths).length}`);
  console.log(`   Schemas: ${Object.keys(spec.components.schemas).length}`);
  console.log(`   Tags: ${spec.tags.length}`);

  process.exit(0);
} catch (e) {
  console.error('❌ Failed to generate swagger spec:', e.message);
  process.exit(1);
}
