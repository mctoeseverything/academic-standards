-- Sample Academic Standards Board seed data.

DELETE FROM student_answers;
DELETE FROM student_attempts;
DELETE FROM course_tests;
DELETE FROM course_enrollments;
DELETE FROM test_questions;
DELETE FROM tests;
DELETE FROM question_bank;
DELETE FROM courses;
DELETE FROM users;

INSERT INTO users (id, role, name, email, password_hash, institution, subject_area)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'teacher', 'Alicia Monroe', 'alicia.monroe@asb-demo.edu', 'plain:Password123!', 'Roosevelt High School', 'Mathematics'),
  ('10000000-0000-0000-0000-000000000002', 'teacher', 'Daniel Carter', 'daniel.carter@asb-demo.edu', 'plain:Password123!', 'Roosevelt High School', 'STEM');

INSERT INTO users (id, role, name, email, password_hash, date_of_birth, student_id)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'student', 'Amara Patel', 'amara.patel@student.asb-demo.edu', 'plain:Password123!', '2008-02-14', 'S-1001'),
  ('20000000-0000-0000-0000-000000000002', 'student', 'Julian Brooks', 'julian.brooks@student.asb-demo.edu', 'plain:Password123!', '2008-04-22', 'S-1002'),
  ('20000000-0000-0000-0000-000000000003', 'student', 'Maya Nguyen', 'maya.nguyen@student.asb-demo.edu', 'plain:Password123!', '2008-07-11', 'S-1003'),
  ('20000000-0000-0000-0000-000000000004', 'student', 'Noah Bennett', 'noah.bennett@student.asb-demo.edu', 'plain:Password123!', '2008-05-03', 'S-1004'),
  ('20000000-0000-0000-0000-000000000005', 'student', 'Olivia Reed', 'olivia.reed@student.asb-demo.edu', 'plain:Password123!', '2008-09-18', 'S-1005'),
  ('20000000-0000-0000-0000-000000000006', 'student', 'Isaac Flores', 'isaac.flores@student.asb-demo.edu', 'plain:Password123!', '2008-01-27', 'S-1006'),
  ('20000000-0000-0000-0000-000000000007', 'student', 'Leah Kim', 'leah.kim@student.asb-demo.edu', 'plain:Password123!', '2008-03-30', 'S-1007'),
  ('20000000-0000-0000-0000-000000000008', 'student', 'Ethan Ross', 'ethan.ross@student.asb-demo.edu', 'plain:Password123!', '2008-06-06', 'S-1008'),
  ('20000000-0000-0000-0000-000000000009', 'student', 'Sofia Hernandez', 'sofia.hernandez@student.asb-demo.edu', 'plain:Password123!', '2008-10-09', 'S-1009'),
  ('20000000-0000-0000-0000-000000000010', 'student', 'Caleb Price', 'caleb.price@student.asb-demo.edu', 'plain:Password123!', '2008-12-12', 'S-1010');

INSERT INTO courses (id, teacher_id, name, subject_area, description)
VALUES
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Algebra I - Period 1', 'Algebra I', 'Core Algebra I section focused on functions, systems, and quadratics.'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Algebra I - Period 4', 'Algebra I', 'Mixed-ability Algebra I class using ASB benchmark assessments.'),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'Foundations of STEM Problem Solving', 'Integrated Math', 'Cross-disciplinary practice on modeling and quantitative reasoning.');

INSERT INTO course_enrollments (course_id, student_id)
VALUES
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002'),
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003'),
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000005'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000006'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000007'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000008'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000009'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000010');

INSERT INTO question_bank (
  id, creator_id, type, prompt, choices, correct_answer, explanation, subject, topic, difficulty, tags, info_box,
  graph, ordering_items, accepted_answers, placeholder_text, blank_definitions, blank_template, matching_pairs
)
VALUES
  (
    '40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'multiple_choice',
    'A linear function $f$ satisfies $f(-3) = 11$ and $f(5) = -5$. Which equation correctly defines $f(x)$?',
    '["$f(x) = -2x + 5$","$f(x) = 2x - 5$","$f(x) = -2x - 5$","$f(x) = -2x + 4$"]',
    '0',
    'Use the two points to find slope $m=-2$, then solve for the intercept using either ordered pair.',
    'Algebra I', 'Linear Functions', 2, ARRAY['linear','slope'], NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
  ),
  (
    '40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'multiple_choice',
    'The equation $4(2x - 3) = 3(x + 1) + 5x$ is solved below. Identify the step that contains the first error.',
    '["Step 1 — the distributive property was applied incorrectly","Step 2 — like terms on the right were combined incorrectly","Step 3 — the subtraction of $8x$ was applied incorrectly","There is no error; the conclusion is correct"]',
    '3',
    'Each step is valid: both sides simplify to $8x-12=8x+3$, so the equation has no solution.',
    'Algebra I', 'Equations', 2, ARRAY['equations','error-analysis'],
    '["Step 1: $8x - 12 = 3x + 3 + 5x$","Step 2: $8x - 12 = 8x + 3$","Step 3: $-12 = 3$","Step 4: No solution"]',
    NULL, NULL, NULL, NULL, NULL, NULL, NULL
  ),
  (
    '40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'ordering',
    'The steps below solve $3(x - 2) + 4 = 2x + 7$, but they are out of order. Drag them into the correct sequence from first to last.',
    NULL,
    '[0,1,2,3]',
    'Distribute first, combine like terms, move variable terms together, then isolate the variable.',
    'Algebra I', 'Equations', 2, ARRAY['ordering','equations'], NULL, NULL,
    '["Distribute: $3x - 6 + 4 = 2x + 7$","Combine like terms on the left: $3x - 2 = 2x + 7$","Subtract $2x$ from both sides: $x - 2 = 7$","Add $2$ to both sides: $x = 9$"]',
    NULL, NULL, NULL, NULL, NULL
  ),
  (
    '40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'fill_blank',
    'A line has slope $-\\dfrac{3}{4}$ and passes through the point $(4, 1)$. Complete the slope-intercept equation of the line.',
    NULL,
    '{"slope":["-3/4","-0.75"],"intercept":["4"]}',
    'Substitute the slope and point into $y=mx+b$ to solve for the intercept.',
    'Algebra I', 'Linear Equations', 3, ARRAY['fill-blank','linear'], NULL, NULL, NULL, NULL, NULL,
    '[{"id":"slope","label":"slope","acceptedAnswers":["-3/4","-0.75"]},{"id":"intercept","label":"y-intercept","acceptedAnswers":["4"]}]',
    '$y =$ [slope] $x +$ [intercept]', NULL
  ),
  (
    '40000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'numeric',
    'The sum of three consecutive even integers is $78$. What is the largest of the three integers?',
    NULL,
    '["28"]',
    'Let the integers be $x$, $x+2$, and $x+4$ and solve $3x+6=78$.',
    'Algebra I', 'Number Sense', 2, ARRAY['numeric','integers'], NULL, NULL, NULL, '["28"]', 'Enter an integer', NULL, NULL, NULL
  ),
  (
    '40000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'select_multiple',
    'Select ALL expressions equivalent to $(3x^2 y^{-1})^2 \\cdot (x^{-3} y^2)^3$.',
    '["$9x^{-5}y^{4}$","$9 \\cdot x^{-5} \\cdot y^{4}$","$\\dfrac{9}{x^5 y^{-4}}$","$\\dfrac{9y^4}{x^5}$"]',
    '[0,1,3]',
    'Apply exponent rules to each factor, then combine like bases.',
    'Algebra I', 'Exponents', 3, ARRAY['select-multiple','exponents'], NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
  ),
  (
    '40000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', 'multiple_choice',
    'A rideshare company charges a flat booking fee plus a per-mile rate. A 4-mile trip costs $\\$8.60$ and an 11-mile trip costs $\\$15.25$. What is the per-mile rate?',
    '["$\\$0.85$","$\\$0.95$","$\\$1.05$","$\\$1.25$"]',
    '1',
    'Use the change in cost over the change in miles: $(15.25-8.60)/(11-4)=0.95$.',
    'Algebra I', 'Linear Modeling', 2, ARRAY['modeling','rate'], NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
  ),
  (
    '40000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', 'numeric',
    'Two cars depart from the same point in opposite directions. Car A travels at $55$ mph and Car B travels at $70$ mph. After how many minutes will the cars be exactly $62.5$ miles apart?',
    NULL,
    '["30"]',
    'Add the speeds for opposite directions, solve $125t=62.5$, then convert hours to minutes.',
    'Algebra I', 'Rate Problems', 2, ARRAY['numeric','distance-rate-time'], NULL, NULL, NULL, '["30"]', 'Enter minutes', NULL, NULL, NULL
  ),
  (
    '40000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', 'matching',
    'Match each system of equations to the correct description of its solution type.',
    NULL,
    '[0,1,2,3]',
    'Parallel lines have no solution, identical equations have infinitely many, and intersecting lines have one solution.',
    'Algebra I', 'Systems', 3, ARRAY['matching','systems'], NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    '[{"left":"$y = 2x + 1$ and $y = 2x - 3$","right":"No solution (parallel lines)"},{"left":"$y = 3x - 1$ and $2y = 6x - 2$","right":"Infinitely many solutions"},{"left":"$y = x + 2$ and $y = -x + 4$","right":"Unique solution at $(1, 3)$"},{"left":"$2x + y = 5$ and $x - y = 1$","right":"Unique solution at $(2, 1)$"}]'
  ),
  (
    '40000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', 'multiple_choice',
    'A contractor charges $\\$45$/hr for labor plus $\\$320$ in materials. A client''s budget is at most $\\$1{,}010$. Which inequality models the maximum labor hours $h$?',
    '["$45h + 320 \\leq 1010;\\quad h \\leq 15$","$45h \\leq 690;\\quad h \\leq 14$","$45h + 320 < 1010;\\quad h < 15.3$","$45(h+320) \\leq 1010;\\quad h \\leq -297.5$"]',
    '0',
    'Subtract the materials cost first, then divide by the hourly rate.',
    'Algebra I', 'Inequalities', 2, ARRAY['multiple-choice','inequalities'], NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
  ),
  (
    '40000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', 'hotspot',
    'The line $y = 2x - 3$ is graphed below. Click the point on the grid that represents the $x$-intercept of this line.',
    NULL,
    '{"x":1.5,"y":0}',
    'The $x$-intercept occurs when $y=0$, so solve $0=2x-3$.',
    'Algebra I', 'Graphs', 3, ARRAY['hotspot','graphs'], NULL,
    '{"xMin":-4,"xMax":6,"yMin":-5,"yMax":5,"line":{"slope":2,"intercept":-3},"correctX":1.5,"correctY":0,"snapGrid":0.5,"tolerance":0.6}',
    NULL, NULL, NULL, NULL, NULL
  ),
  (
    '40000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000001', 'graph_line',
    'Line $\\ell$ passes through $(-2,1)$ with slope $\\dfrac{3}{2}$. Which labeled point is the $y$-intercept of $\\ell$?',
    NULL,
    '"A"',
    'Use slope-intercept form to find that the line crosses the $y$-axis at $(0,4)$.',
    'Algebra I', 'Graphs', 4, ARRAY['graph-line','slope-intercept'],
    '["Use the slope and given point to find where the line crosses the $y$-axis."]',
    '{"xMin":-5,"xMax":7,"yMin":-3,"yMax":9,"line":{"slope":1.5,"intercept":4},"points":[{"id":"A","x":0,"y":4,"label":"A"},{"id":"B","x":0,"y":1,"label":"B"},{"id":"C","x":2,"y":7,"label":"C"},{"id":"D","x":-2,"y":1,"label":"D"},{"id":"E","x":4,"y":5,"label":"E"}]}',
    NULL, NULL, NULL, NULL, NULL
  );

INSERT INTO tests (id, creator_id, course_id, name, description, time_limit_seconds, status, due_date, published_at)
VALUES
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'ASB Algebra Benchmark A', 'Benchmark pulled from the existing exam bank with foundational algebra skills.', 5400, 'published', '2026-05-20', NOW()),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'ASB Algebra Benchmark B', 'Benchmark pulled from the existing exam bank with modeling, systems, and graphing items.', 5400, 'published', '2026-05-27', NOW());

INSERT INTO course_tests (course_id, test_id)
VALUES
  ('30000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002'),
  ('30000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000002');

INSERT INTO test_questions (test_id, question_id, position, section_number, section_title)
VALUES
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 0, 1, 'Foundations & Calibration'),
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 1, 1, 'Foundations & Calibration'),
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', 2, 1, 'Foundations & Calibration'),
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004', 3, 1, 'Foundations & Calibration'),
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000005', 4, 1, 'Foundations & Calibration'),
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000006', 5, 1, 'Foundations & Calibration'),
  ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000007', 0, 2, 'Linear Modeling & Systems'),
  ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000008', 1, 2, 'Linear Modeling & Systems'),
  ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000009', 2, 2, 'Linear Modeling & Systems'),
  ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000010', 3, 2, 'Linear Modeling & Systems'),
  ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000011', 4, 3, 'Functions, Graphs & Transformations'),
  ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000012', 5, 3, 'Functions, Graphs & Transformations');

INSERT INTO student_attempts (
  id, student_id, test_id, course_id, status, time_limit_seconds, time_remaining_seconds,
  score_percent, correct_count, answered_count, total_questions, state, started_at, submitted_at
)
VALUES
  (
    '60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001', 'submitted', 5400, 1320, 83, 5, 6, 6,
    '{"current":5,"answers":{"0":0,"1":3,"2":[0,1,2,3],"3":{"slope":"-3/4","intercept":"4"},"4":"28","5":[0,1,3]},"markedQuestions":[2],"eliminatedChoices":{},"stemMarkup":{},"dragOrder":{"2":[0,1,2,3]},"matchState":{},"hotspotState":{},"time":1320,"submitted":true}',
    NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days' + INTERVAL '68 minutes'
  ),
  (
    '60000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001', 'submitted', 5400, 860, 67, 4, 6, 6,
    '{"current":5,"answers":{"0":0,"1":2,"2":[0,1,2,3],"3":{"slope":"-3/4","intercept":"3"},"4":"28","5":[0,1,2]},"markedQuestions":[],"eliminatedChoices":{},"stemMarkup":{},"dragOrder":{"2":[0,1,2,3]},"matchState":{},"hotspotState":{},"time":860,"submitted":true}',
    NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days' + INTERVAL '76 minutes'
  ),
  (
    '60000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000002', 'submitted', 5400, 1180, 50, 3, 6, 6,
    '{"current":5,"answers":{"0":1,"1":"30","2":{"0":0,"1":1,"2":2,"3":3},"3":0,"4":{"x":1.5,"y":0},"5":"A"},"markedQuestions":[4],"eliminatedChoices":{},"stemMarkup":{},"dragOrder":{},"matchState":{"2":{"0":0,"1":1,"2":2,"3":3}},"hotspotState":{"4":{"x":1.5,"y":0}},"time":1180,"submitted":true}',
    NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '70 minutes'
  );

INSERT INTO student_answers (attempt_id, question_id, question_position, answer_payload, is_correct, explanation)
VALUES
  ('60000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 0, '0', TRUE, 'Use the slope between the points and solve for the intercept.'),
  ('60000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 1, '3', TRUE, 'The work shown is valid, so no error appears.'),
  ('60000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', 2, '[0,1,2,3]', TRUE, 'The algebra sequence is already in correct order.'),
  ('60000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004', 3, '{"slope":"-3/4","intercept":"4"}', TRUE, 'The slope and intercept match the point-slope conversion.'),
  ('60000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000005', 4, '"28"', TRUE, 'The largest even integer is 28.'),
  ('60000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000006', 5, '[0,1,3]', TRUE, 'All three equivalent exponent forms were selected.');
