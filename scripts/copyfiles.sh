#!/bin/bash

# 复制doc目录下的主要文件
cp doc/index.html dist/doc/
cp doc/test/index.html dist/doc/test/
cp -r doc/test/images dist/doc/test/
cp doc/*.png dist/doc/

# 复制extension目录下的文件
cp -r extension/images dist/extension/
cp extension/popup.html dist/extension/popup.html
cp extension/manifest.json dist/doc/update.json