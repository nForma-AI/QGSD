'use strict';
const fs = require('fs');
const path = require('path');

function processFeature(config) {
  if (!config || !config.name) throw new Error('name required');
  return { processed: true, name: config.name, ts: Date.now() };
}

function validateFeature(feature) {
  return feature.processed === true && typeof feature.name === 'string';
}

module.exports = { processFeature, validateFeature };