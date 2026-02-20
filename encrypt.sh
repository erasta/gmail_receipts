#!/bin/bash
gpg -c .env && rm .env && echo "Encrypted."
