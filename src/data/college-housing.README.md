# College housing directory

`college-housing.json` contains published housing names for the nine UC
undergraduate campuses, 23 CSU campus entries (including Cal Poly Maritime
Academy), Stanford, and USC. Keys match `california-colleges.json` exactly.

Each campus entry records official source URLs. `reviewedOn` is the manual
review date, not a promise of current availability. The list includes residence
halls, university apartments, and named housing communities. It is not a complete
inventory of individual buildings, rooms, private rentals, or eligibility rules.
Some campuses publish names primarily at the community level.

To update, review each campus's official housing site, amend its `residences` and
`sources`, and update the review date. Exclude planned buildings that have not
opened and decommissioned housing. Run `npm test -- tests/college-housing.test.ts`
to check campus coverage, duplicate names, source URLs, and form compatibility.

The shared `DormSelect` component uses this directory for student registration,
adding a child, event creation/editing, and event search. A blank selection stays
optional. Other / not listed allows unlisted residences and preserves legacy
free-text values. Changing college clears the current dorm selection. Colleges
outside this directory remain usable via Other / not listed.

Names continue to be stored in the existing `Student.dorm` and `Event.dorm`
columns; no schema migration or automatic rewriting of existing data is needed.
