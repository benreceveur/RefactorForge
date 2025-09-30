-- Database Optimization Analysis: JOIN vs Sequential Queries
-- Analysis of the proposed getUserWithPosts optimization
-- Created for RefactorForge performance evaluation

-- Create test schema similar to the proposed pattern
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS comments;

CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE posts (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE comments (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    post_id INTEGER,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (post_id) REFERENCES posts(id)
);

-- Create performance indexes
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_post_id ON comments(post_id);

-- Insert test data to simulate real-world scenarios
INSERT INTO users (name, email) VALUES 
('John Doe', 'john@example.com'),
('Jane Smith', 'jane@example.com'),
('Bob Wilson', 'bob@example.com'),
('Alice Brown', 'alice@example.com');

-- User 1: Heavy poster (10 posts, 50 comments)
INSERT INTO posts (user_id, title, content) 
SELECT 1, 'Post ' || (row_number() OVER ()), 'Content for post ' || (row_number() OVER ())
FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 
      UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10);

INSERT INTO comments (user_id, post_id, content)
SELECT 1, 
       (SELECT id FROM posts WHERE user_id = 1 ORDER BY RANDOM() LIMIT 1),
       'Comment ' || (row_number() OVER ())
FROM (WITH RECURSIVE cnt(x) AS (
    SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 50
) SELECT x FROM cnt);

-- User 2: Moderate activity (3 posts, 15 comments)  
INSERT INTO posts (user_id, title, content) VALUES 
(2, 'User 2 Post 1', 'Content 1'),
(2, 'User 2 Post 2', 'Content 2'),
(2, 'User 2 Post 3', 'Content 3');

INSERT INTO comments (user_id, post_id, content)
SELECT 2, 
       (SELECT id FROM posts ORDER BY RANDOM() LIMIT 1),
       'User 2 Comment ' || (row_number() OVER ())
FROM (WITH RECURSIVE cnt(x) AS (
    SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x < 15
) SELECT x FROM cnt);

-- User 3: Light activity (1 post, 2 comments)
INSERT INTO posts (user_id, title, content) VALUES (3, 'Single Post', 'Single content');
INSERT INTO comments (user_id, content) VALUES (3, 'Comment 1'), (3, 'Comment 2');

-- User 4: Comments only (0 posts, 5 comments)
INSERT INTO comments (user_id, content) 
SELECT 4, 'User 4 Comment ' || (row_number() OVER ())
FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5);

-- Analysis queries demonstrating the performance implications

-- APPROACH 1: Sequential queries (original approach)
.print "=== SEQUENTIAL QUERIES APPROACH ==="
.timer ON

-- Query 1: Get user
.print "Query 1 - User data:"
EXPLAIN QUERY PLAN SELECT * FROM users WHERE id = 1;
SELECT * FROM users WHERE id = 1;

-- Query 2: Get posts  
.print "\nQuery 2 - User posts:"
EXPLAIN QUERY PLAN SELECT * FROM posts WHERE user_id = 1;
SELECT COUNT(*) as post_count FROM posts WHERE user_id = 1;

-- Query 3: Get comments
.print "\nQuery 3 - User comments:"  
EXPLAIN QUERY PLAN SELECT * FROM comments WHERE user_id = 1;
SELECT COUNT(*) as comment_count FROM comments WHERE user_id = 1;

-- APPROACH 2: JOIN approach (proposed optimization)
.print "\n=== JOIN APPROACH (PROPOSED) ==="

.print "Single JOIN query:"
EXPLAIN QUERY PLAN 
SELECT 
    u.*,
    p.id as post_id, p.title as post_title, p.content as post_content,
    c.id as comment_id, c.content as comment_content
FROM users u
LEFT JOIN posts p ON u.id = p.user_id
LEFT JOIN comments c ON u.id = c.user_id
WHERE u.id = 1;

-- Demonstrate the CARTESIAN PRODUCT problem
.print "\nCartesian product demonstration (User 1 - heavy activity):"
SELECT COUNT(*) as total_rows_returned,
       COUNT(DISTINCT u.id) as unique_users,
       COUNT(DISTINCT p.id) as unique_posts, 
       COUNT(DISTINCT c.id) as unique_comments
FROM users u
LEFT JOIN posts p ON u.id = p.user_id
LEFT JOIN comments c ON u.id = c.user_id
WHERE u.id = 1;

.print "\nData duplication analysis:"
WITH joined_data AS (
    SELECT 
        u.*,
        p.id as post_id, p.title as post_title, p.content as post_content,
        c.id as comment_id, c.content as comment_content
    FROM users u
    LEFT JOIN posts p ON u.id = p.user_id
    LEFT JOIN comments c ON u.id = c.user_id
    WHERE u.id = 1
)
SELECT 
    COUNT(*) as total_result_rows,
    COUNT(DISTINCT post_id) as distinct_posts,
    COUNT(DISTINCT comment_id) as distinct_comments,
    -- Data transfer size estimation (simplified)
    LENGTH(GROUP_CONCAT(u.name || u.email)) / COUNT(*) as avg_user_data_per_row
FROM joined_data, users u WHERE u.id = 1;

-- APPROACH 3: Optimized separate queries with Promise.all() simulation
.print "\n=== OPTIMIZED SEPARATE QUERIES ==="

.print "Optimized individual queries (what Promise.all would execute):"

EXPLAIN QUERY PLAN 
SELECT id, name, email, created_at FROM users WHERE id = 1;

EXPLAIN QUERY PLAN
SELECT id, title, content, created_at FROM posts WHERE user_id = 1;

EXPLAIN QUERY PLAN  
SELECT id, content, created_at FROM comments WHERE user_id = 1;

-- Performance comparison for different user activity levels
.print "\n=== PERFORMANCE COMPARISON ACROSS USER TYPES ==="

-- Light user (User 3)
.print "\nLight activity user (1 post, 2 comments):"
SELECT 'JOIN_APPROACH' as method, COUNT(*) as rows_returned
FROM users u
LEFT JOIN posts p ON u.id = p.user_id
LEFT JOIN comments c ON u.id = c.user_id
WHERE u.id = 3

UNION ALL

SELECT 'SEQUENTIAL_TOTAL' as method, 
       (SELECT COUNT(*) FROM users WHERE id = 3) + 
       (SELECT COUNT(*) FROM posts WHERE user_id = 3) + 
       (SELECT COUNT(*) FROM comments WHERE user_id = 3) as rows_returned;

-- Heavy user (User 1)  
.print "\nHeavy activity user (10 posts, 50 comments):"
SELECT 'JOIN_APPROACH' as method, COUNT(*) as rows_returned
FROM users u
LEFT JOIN posts p ON u.id = p.user_id
LEFT JOIN comments c ON u.id = c.user_id
WHERE u.id = 1

UNION ALL

SELECT 'SEQUENTIAL_TOTAL' as method,
       (SELECT COUNT(*) FROM users WHERE id = 1) + 
       (SELECT COUNT(*) FROM posts WHERE user_id = 1) + 
       (SELECT COUNT(*) FROM comments WHERE user_id = 1) as rows_returned;

-- Memory and bandwidth analysis
.print "\n=== MEMORY & BANDWIDTH IMPACT ANALYSIS ==="

-- Simulate memory usage (data duplication factor)
WITH memory_analysis AS (
    SELECT u.id as user_id,
           COUNT(*) as join_result_rows,
           COUNT(DISTINCT p.id) as actual_posts,
           COUNT(DISTINCT c.id) as actual_comments,
           CASE 
               WHEN COUNT(DISTINCT p.id) > 0 AND COUNT(DISTINCT c.id) > 0 
               THEN COUNT(*) * 1.0 / (COUNT(DISTINCT p.id) + COUNT(DISTINCT c.id))
               ELSE COUNT(*)
           END as duplication_factor
    FROM users u
    LEFT JOIN posts p ON u.id = p.user_id
    LEFT JOIN comments c ON u.id = c.user_id
    WHERE u.id IN (1, 2, 3, 4)
    GROUP BY u.id
)
SELECT 
    user_id,
    join_result_rows,
    actual_posts,
    actual_comments,
    ROUND(duplication_factor, 2) as data_duplication_factor,
    CASE 
        WHEN duplication_factor > 5 THEN 'HIGH_OVERHEAD'
        WHEN duplication_factor > 2 THEN 'MODERATE_OVERHEAD' 
        ELSE 'LOW_OVERHEAD'
    END as performance_impact
FROM memory_analysis
ORDER BY user_id;

.print "\n=== RECOMMENDATIONS BASED ON ANALYSIS ==="
.print "1. JOIN approach creates N*M cartesian product (posts × comments)"
.print "2. For users with many posts AND comments, data duplication is severe"
.print "3. Sequential queries transfer less data but require more round trips"
.print "4. Optimal approach depends on user activity patterns and network latency"

.timer OFF