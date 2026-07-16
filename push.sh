#!/data/data/com.termux/files/usr/bin/bash

cd ~/studyreck

pkg install -y git unzip

git config --global user.name "lakshyasamriddha"

git config --global user.email "lakshyasamriddha3@gmail.com"

mkdir -p upload_folder

unzip -o studyreck.zip -d upload_folder

cd upload_folder

git init

git branch -M main

git remote remove origin 2>/dev/null

git remote add origin https://github.com/lakshyasamriddha/Studyhex.git

git add .

git commit -m "Upload studyreck"

git push -u origin main

