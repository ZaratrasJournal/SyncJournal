#!/usr/bin/env node
// De release-poort: `node tests/run-release.js` moet groen zijn vóór er iets vertrekt.
//
// Bestaat als eigen commando omdat een vlag te makkelijk vergeten wordt op het moment dat
// het ertoe doet. Welke specs meedoen staat in release-set.js; het draaien zelf doet
// run-all-sj.js. Argumenten (bv. --jobs=1) gaan gewoon door.
process.argv.push('--release');
require('./run-all-sj.js');
