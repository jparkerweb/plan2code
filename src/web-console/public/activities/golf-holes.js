// Plan2Code Web Console - mini golf's courses: the six eighteen-hole courses, in the order the course dashboard shows them.
//
// Each course is its own file, golf-course-<id>.js, built with golf-kit.js
// (which documents what a hole holds); its look (palette, props and
// scenery) is golf-draw.js and golf-decor.js for the first two and
// golf-look-<id>.js for the rest. Adding a course is one file here, one
// look, and its id in the Mini golf entry of activities.js, which keeps its
// best score.

import { COURSE_W, COURSE_H } from "./golf-kit.js";
import pirate from "./golf-course-pirate.js";
import cave from "./golf-course-cave.js";
import dino from "./golf-course-dino.js";
import candy from "./golf-course-candy.js";
import space from "./golf-course-space.js";
import frost from "./golf-course-frost.js";

export { COURSE_W, COURSE_H };

export const COURSES = Object.freeze([pirate, cave, dino, candy, space, frost]);

// Every course is eighteen holes; the scorecard after the ninth is the turn.
export const HOLE_COUNT = 18;
export const FRONT_NINE = 9;

export const courseById = (id) => COURSES.find((c) => c.id === id) || COURSES[0];
