// Test script to verify the repository count fix
const fetch = require('node-fetch');

async function testRepositoryCountFix() {
    try {
        console.log('🧪 Testing Repository Count Fix...\n');

        // 1. Check database repository count
        console.log('1. Checking database repository count...');
        const { exec } = require('child_process');
        const dbCount = await new Promise((resolve, reject) => {
            exec('sqlite3 /Users/benreceveur/GitHub/RefactorForge/backend/refactorforge.db "SELECT COUNT(*) FROM repositories;"',
                (error, stdout, stderr) => {
                    if (error) reject(error);
                    else resolve(parseInt(stdout.trim()));
                });
        });
        console.log(`   Database repositories: ${dbCount}`);

        // 2. Check API response
        console.log('\n2. Checking API response...');
        const response = await fetch('http://localhost:8001/api/improvements');
        if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`   API repositoryCount: ${data.repositoryCount}`);
        console.log(`   API repositoriesAnalyzed: ${data.repositoriesAnalyzed}`);
        console.log(`   API improvements length: ${data.improvements ? data.improvements.length : 0}`);

        // 3. Count unique repositories in improvements
        const uniqueRepos = data.improvements ?
            Array.from(new Set(data.improvements.map(imp => imp.repository))).length : 0;
        console.log(`   Unique repositories in improvements: ${uniqueRepos}`);

        // 4. Verify the fix
        console.log('\n3. Fix verification:');
        const expectedRepoCount = 12;

        if (dbCount === expectedRepoCount) {
            console.log('   ✅ Database has correct number of repositories (12)');
        } else {
            console.log(`   ❌ Database has ${dbCount} repositories, expected ${expectedRepoCount}`);
        }

        if (data.repositoryCount === expectedRepoCount) {
            console.log('   ✅ API returns correct repositoryCount (12)');
        } else {
            console.log(`   ❌ API returns repositoryCount: ${data.repositoryCount}, expected ${expectedRepoCount}`);
        }

        if (data.repositoriesAnalyzed === expectedRepoCount) {
            console.log('   ✅ API returns correct repositoriesAnalyzed (12)');
        } else {
            console.log(`   ❌ API returns repositoriesAnalyzed: ${data.repositoriesAnalyzed}, expected ${expectedRepoCount}`);
        }

        // 5. Summary
        console.log('\n4. Summary:');
        const isFixed = data.repositoryCount === expectedRepoCount &&
                       data.repositoriesAnalyzed === expectedRepoCount &&
                       dbCount === expectedRepoCount;

        if (isFixed) {
            console.log('   🎉 SUCCESS: Repository count issue is FIXED!');
            console.log('   📊 Frontend will now show "Analyzing 12 repositories" instead of "Analyzing 5 repositories"');
        } else {
            console.log('   ❌ ISSUE: Repository count is still not correctly displayed');
        }

        // 6. Repositories with recommendations breakdown
        console.log('\n5. Repository recommendation breakdown:');
        const repositoriesWithRecs = await new Promise((resolve, reject) => {
            exec('sqlite3 /Users/benreceveur/GitHub/RefactorForge/backend/refactorforge.db "SELECT r.full_name, COUNT(rr.id) as count FROM repositories r LEFT JOIN repository_recommendations rr ON r.id = rr.repository_id GROUP BY r.id ORDER BY count DESC;"',
                (error, stdout, stderr) => {
                    if (error) reject(error);
                    else resolve(stdout.trim().split('\n').map(line => line.split('|')));
                });
        });

        repositoriesWithRecs.forEach(([repo, count]) => {
            if (repo) {
                console.log(`   ${repo}: ${count} recommendations`);
            }
        });

        const reposWithRecs = repositoriesWithRecs.filter(([repo, count]) => repo && parseInt(count) > 0).length;
        console.log(`\n   📈 ${reposWithRecs} repositories have recommendations`);
        console.log(`   📋 ${expectedRepoCount - reposWithRecs} repositories need recommendations generated`);

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.log('\nMake sure:');
        console.log('1. Backend server is running on http://localhost:8001');
        console.log('2. Database exists at /Users/benreceveur/GitHub/RefactorForge/backend/refactorforge.db');
    }
}

testRepositoryCountFix();