#!/bin/bash
rm -f largerFhirBundles/*
rm -f output/*
node src/generator.js
node src/bundleBundles.js