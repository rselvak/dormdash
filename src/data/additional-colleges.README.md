# Additional supported U.S. universities

`additional-colleges.json` adds 21 requested universities to the original 34
California registration campuses, for 55 enabled choices. The original full
California dataset remains available for legacy record lookups.

Campus identity and undergraduate program categories come from the U.S. Department
of Education College Scorecard API. Each `unitid` is matched against the returned
institution name and city. Credentials 1-3 are included, consistently with the
California dataset; graduate credentials and minors are excluded. Scorecard's
standardized program categories may differ from a school's marketing names and
may lag newly introduced programs.

Main-campus scope: UIUC; University of Chicago; Purdue West Lafayette;
University of Washington Seattle; NYU New York (including Brooklyn housing);
Georgia Tech Atlanta; Indiana Bloomington; MIT; Princeton; Harvard; Yale; Penn;
Duke; Johns Hopkins Baltimore; Northwestern Evanston; Carnegie Mellon Pittsburgh;
Cornell Ithaca; Brown; Rice; Michigan Ann Arbor; Rutgers New Brunswick (including
Busch, College Avenue, Cook/Douglass, and Livingston residential areas).

Every entry includes official housing source URLs and a housing review date.
Published residence halls, apartments, residential colleges, and housing
communities are included. These are not exhaustive building/room inventories,
eligibility promises, or live availability feeds. MIT McCormick Hall is excluded
while closed for renovation. Other / not listed remains available.

The registration combobox searches aliases such as UIUC, UW, NYU, MIT, Georgia
Tech, IU, and UPenn while storing the canonical institution name. Registration
and Add Student validate against the combined supported list. Shared major and
dorm dropdowns also supply the event creation, editing, and search forms.

To refresh programs, run `node scripts/fetch-additional-colleges.mjs`. Set
`SCORECARD_API_KEY` in the shell if the public demo limit is reached. The script
checks institutional identity before writing and preserves curated residences.
Review housing source pages manually before changing `residences` and
`housingReviewedOn`. Do not rename existing canonical college keys casually;
they are used to match events to students.
