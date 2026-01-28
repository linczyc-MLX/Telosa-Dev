#!/bin/bash
# Copy static files to dist/static for proper serving
mkdir -p dist/static
cp public/static/app.js dist/static/app.js
cp public/static/style.css dist/static/style.css

# Update _routes.json - let worker handle everything except static
echo '{"version":1,"include":["/api/*","/"],"exclude":["/static/*"]}' > dist/_routes.json

echo "Post-build complete!"


