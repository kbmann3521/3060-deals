#!/bin/bash
cd "$(dirname "$0")"
PATH="./node_modules/.bin:$PATH"
next dev
