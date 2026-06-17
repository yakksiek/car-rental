// core
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

// @ilamy/calendar uses dayjs for all date math and expects these plugins to be
// extended on the shared singleton. Importing this module (for its side effect)
// from the calendar island and the mapper guarantees the plugins are present
// before any calendar date is constructed (S-03 Phase 6).
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

export default dayjs;
