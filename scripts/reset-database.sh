#!/bin/bash

echo "========================================"
echo "   Lasso Proxy Database Reset Tool"
echo "========================================"
echo ""

echo "This will permanently delete all data in the database!"
echo ""

read -p "Are you sure you want to continue? (y/N): " confirm

if [[ $confirm == [yY] || $confirm == [yY][eE][sS] ]]; then
    echo ""
    echo "Starting database reset..."
    node scripts/reset-database.js --confirm
else
    echo ""
    echo "Database reset cancelled."
fi

echo ""
read -p "Press Enter to continue"
