#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Load baseline requirements filtered by project profile.
 *
 * @param {string} profile - One of: web, mobile, desktop, api, cli, library
 * @param {string} [basePath] - Path to baseline-requirements directory, defaults to qgsd-core/defaults/baseline-requirements
 * @returns {Object} { profile, label, description, categories: [...], total }
 */
function loadBaselineRequirements(profile, basePath) {
  const defaultBasePath = path.resolve(__dirname, '../qgsd-core/defaults/baseline-requirements');
  const basePathToUse = basePath || defaultBasePath;

  // Read index.json
  const indexPath = path.join(basePathToUse, 'index.json');
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  const index = JSON.parse(indexContent);

  // Validate profile
  if (!index.profiles[profile]) {
    throw new Error(`Invalid profile: ${profile}. Supported profiles: ${Object.keys(index.profiles).join(', ')}`);
  }

  const profileConfig = index.profiles[profile];
  const profileLabel = profileConfig.label;
  const profileDescription = profileConfig.description;

  // Process categories
  const categories = [];
  let totalRequirements = 0;

  for (const categoryMeta of index.categories) {
    const categoryFile = categoryMeta.file;
    const categoryPath = path.join(basePathToUse, categoryFile);

    // Check if we should load this category at all
    if (profileConfig.includes_only && !profileConfig.includes_only.includes(categoryFile.replace('.json', ''))) {
      continue; // Skip categories not in includes_only
    }

    const categoryContent = fs.readFileSync(categoryPath, 'utf8');
    const category = JSON.parse(categoryContent);

    // Filter requirements based on profile
    let filteredRequirements = category.requirements;

    if (!profileConfig.includes_all) {
      // Filter based on per-requirement profiles array
      filteredRequirements = category.requirements.filter(req => req.profiles.includes(profile));
    }

    if (filteredRequirements.length === 0) {
      continue; // Skip empty categories
    }

    // Assign sequential IDs per category using id_template
    // Extract prefix from id_template (e.g., "UX-{N}" -> "UX")
    const idTemplate = filteredRequirements[0].id_template;
    const prefix = idTemplate.split('-')[0];

    const categoryRequirements = filteredRequirements.map((req, index) => {
      const reqId = `${prefix}-${String(index + 1).padStart(2, '0')}`;
      return {
        id: reqId,
        text: req.text,
        intent: req.intent,
        verifiable_by: req.verifiable_by,
      };
    });

    categories.push({
      name: category.category,
      description: category.description,
      requirements: categoryRequirements,
    });

    totalRequirements += categoryRequirements.length;
  }

  return {
    profile,
    label: profileLabel,
    description: profileDescription,
    categories,
    total: totalRequirements,
  };
}

// CLI mode
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--list-profiles')) {
    const indexPath = path.resolve(__dirname, '../qgsd-core/defaults/baseline-requirements/index.json');
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    const index = JSON.parse(indexContent);
    const profiles = Object.entries(index.profiles).map(([key, val]) => ({
      key,
      label: val.label,
      description: val.description,
    }));
    console.log(JSON.stringify(profiles, null, 2));
    process.exit(0);
  }

  const profileIdx = args.indexOf('--profile');
  if (profileIdx === -1 || !args[profileIdx + 1]) {
    console.error('Usage: node bin/load-baseline-requirements.cjs --profile <web|mobile|desktop|api|cli|library>');
    console.error('       node bin/load-baseline-requirements.cjs --list-profiles');
    process.exit(1);
  }

  const profile = args[profileIdx + 1];
  const result = loadBaselineRequirements(profile);
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { loadBaselineRequirements };
