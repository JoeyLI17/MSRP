# MSRP

Get MSRP of cars as agent skills.

## Skill structure

Each OEM has its own skill folder. The first OEM skills are:

- `/home/runner/work/MSRP/MSRP/skills/BMW`
- `/home/runner/work/MSRP/MSRP/skills/Benz`

Both skills default to Chinese official web pages when fetching MSRP.

## Dynamic web support

The Benz skill includes Python code for highly dynamic pages (for example, Mercedes-Benz China official pages) using Playwright browser automation.
