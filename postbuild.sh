#!/bin/bash
# Copy static files to dist root with clear names
cp public/static/app.js dist/app.js
cp public/static/style.css dist/style.css

# Update _routes.json - let worker handle everything
echo '{"version":1,"include":["/*"],"exclude":[]}' > dist/_routes.json

echo "Post-build complete!"


