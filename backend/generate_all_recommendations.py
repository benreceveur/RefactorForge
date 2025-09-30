#!/usr/bin/env python3
"""
Multi-Repository Recommendation Generator
Generates recommendations for all repositories in the RefactorForge system.
"""

import requests
import json
import time
from typing import List, Dict, Any
from dataclasses import dataclass
from datetime import datetime


@dataclass
class RecommendationResult:
    """Data class to store recommendation generation results."""
    repository_id: int
    repository_name: str
    tech_stack: str
    recommendations_count: int
    success: bool
    error_message: str = ""
    generation_time: float = 0.0


class MultiRepositoryRecommendationGenerator:
    """Handles recommendation generation for multiple repositories."""
    
    def __init__(self, base_url: str = "http://localhost:8001"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'RefactorForge-RecommendationGenerator/1.0'
        })
    
    def fetch_repositories(self) -> List[Dict[str, Any]]:
        """Fetch all repositories from the API."""
        try:
            url = f"{self.base_url}/api/repositories"
            print(f"🔍 Fetching repositories from {url}")
            
            response = self.session.get(url)
            response.raise_for_status()
            
            repositories = response.json()
            print(f"✅ Found {len(repositories)} repositories")
            return repositories
            
        except requests.exceptions.RequestException as e:
            print(f"❌ Error fetching repositories: {e}")
            return []
    
    def generate_recommendations_for_repository(self, repo_id: int, repo_name: str, tech_stack: str) -> RecommendationResult:
        """Generate recommendations for a specific repository."""
        start_time = time.time()
        
        try:
            url = f"{self.base_url}/api/repositories/{repo_id}/recommendations"
            print(f"🚀 Generating recommendations for {repo_name} (ID: {repo_id})")
            
            # Make POST request to generate recommendations
            response = self.session.post(url)
            response.raise_for_status()
            
            result_data = response.json()
            generation_time = time.time() - start_time
            
            # Extract recommendations count
            recommendations_count = 0
            if isinstance(result_data, dict):
                if 'recommendations' in result_data:
                    recommendations_count = len(result_data['recommendations'])
                elif 'count' in result_data:
                    recommendations_count = result_data['count']
                elif 'total' in result_data:
                    recommendations_count = result_data['total']
                else:
                    # Try to count any array-like structures
                    for key, value in result_data.items():
                        if isinstance(value, list):
                            recommendations_count = max(recommendations_count, len(value))
            elif isinstance(result_data, list):
                recommendations_count = len(result_data)
            
            print(f"✅ Generated {recommendations_count} recommendations for {repo_name} in {generation_time:.2f}s")
            
            return RecommendationResult(
                repository_id=repo_id,
                repository_name=repo_name,
                tech_stack=tech_stack,
                recommendations_count=recommendations_count,
                success=True,
                generation_time=generation_time
            )
            
        except requests.exceptions.RequestException as e:
            generation_time = time.time() - start_time
            error_msg = str(e)
            print(f"❌ Failed to generate recommendations for {repo_name}: {error_msg}")
            
            return RecommendationResult(
                repository_id=repo_id,
                repository_name=repo_name,
                tech_stack=tech_stack,
                recommendations_count=0,
                success=False,
                error_message=error_msg,
                generation_time=generation_time
            )
    
    def verify_metrics_populated(self, repo_id: int, repo_name: str) -> Dict[str, Any]:
        """Verify that recommendations have proper metrics data populated."""
        try:
            url = f"{self.base_url}/api/repositories/{repo_id}/recommendations"
            print(f"🔍 Verifying metrics for {repo_name} (ID: {repo_id})")
            
            response = self.session.get(url)
            response.raise_for_status()
            
            recommendations = response.json()
            if not recommendations:
                return {"status": "no_recommendations", "metrics_populated": False}
            
            # Check if recommendations have metrics data
            metrics_count = 0
            total_recommendations = 0
            sample_recommendation = None
            
            if isinstance(recommendations, list):
                total_recommendations = len(recommendations)
                sample_recommendation = recommendations[0] if recommendations else None
                for rec in recommendations:
                    if isinstance(rec, dict):
                        metrics = rec.get('metrics', {})
                        has_metrics = (
                            bool(metrics.get('timeSaved')) and metrics.get('timeSaved') != 'N/A' or
                            bool(metrics.get('bugsPrevented')) and metrics.get('bugsPrevented') != 'N/A' or
                            bool(metrics.get('performanceGain')) and metrics.get('performanceGain') != 'N/A'
                        )
                        if has_metrics:
                            metrics_count += 1
            elif isinstance(recommendations, dict):
                # Sometimes the API returns a dict with recommendations array
                if 'recommendations' in recommendations and isinstance(recommendations['recommendations'], list):
                    rec_list = recommendations['recommendations']
                    total_recommendations = len(rec_list)
                    sample_recommendation = rec_list[0] if rec_list else None
                    for rec in rec_list:
                        if isinstance(rec, dict):
                            metrics = rec.get('metrics', {})
                            has_metrics = (
                                bool(metrics.get('timeSaved')) and metrics.get('timeSaved') != 'N/A' or
                                bool(metrics.get('bugsPrevented')) and metrics.get('bugsPrevented') != 'N/A' or
                                bool(metrics.get('performanceGain')) and metrics.get('performanceGain') != 'N/A'
                            )
                            if has_metrics:
                                metrics_count += 1
                else:
                    # Single recommendation object
                    total_recommendations = 1
                    sample_recommendation = recommendations
                    metrics = recommendations.get('metrics', {})
                    has_metrics = (
                        bool(metrics.get('timeSaved')) and metrics.get('timeSaved') != 'N/A' or
                        bool(metrics.get('bugsPrevented')) and metrics.get('bugsPrevented') != 'N/A' or
                        bool(metrics.get('performanceGain')) and metrics.get('performanceGain') != 'N/A'
                    )
                    if has_metrics:
                        metrics_count = 1
            
            metrics_populated = metrics_count > 0
            print(f"✅ {repo_name}: {metrics_count}/{total_recommendations} recommendations have metrics")
            
            return {
                "status": "success",
                "total_recommendations": total_recommendations,
                "recommendations_with_metrics": metrics_count,
                "metrics_populated": metrics_populated,
                "sample_recommendation": sample_recommendation
            }
            
        except requests.exceptions.RequestException as e:
            print(f"❌ Failed to verify metrics for {repo_name}: {e}")
            return {"status": "error", "error": str(e), "metrics_populated": False}

    def generate_all_recommendations(self) -> List[RecommendationResult]:
        """Generate recommendations for all repositories."""
        print("🎯 Starting multi-repository recommendation generation")
        print("=" * 60)
        
        # Fetch all repositories
        repositories = self.fetch_repositories()
        if not repositories:
            print("❌ No repositories found or error occurred")
            return []
        
        results = []
        total_start_time = time.time()
        
        # Generate recommendations for each repository
        for repo in repositories:
            repo_id = repo.get('id')
            repo_name = repo.get('name', 'Unknown')
            tech_stack = repo.get('techStack', 'Unknown')
            
            if not repo_id:
                print(f"⚠️  Skipping repository with missing ID: {repo_name}")
                continue
            
            result = self.generate_recommendations_for_repository(repo_id, repo_name, tech_stack)
            results.append(result)
            
            # Brief pause between requests to be respectful to the API
            time.sleep(0.5)
        
        total_time = time.time() - total_start_time
        print("\n" + "=" * 60)
        print(f"🏁 Generation completed in {total_time:.2f} seconds")
        
        # After generating all recommendations, verify metrics are populated
        print("\n🔍 Verifying metrics are populated...")
        print("=" * 60)
        
        verification_results = []
        for repo in repositories:
            repo_id = repo.get('id')
            repo_name = repo.get('name', 'Unknown')
            
            if not repo_id:
                continue
                
            verification = self.verify_metrics_populated(repo_id, repo_name)
            verification_results.append({
                'repository_id': repo_id,
                'repository_name': repo_name,
                **verification
            })
            time.sleep(0.2)  # Brief pause between verification requests
        
        # Store verification results for summary
        self.verification_results = verification_results
        
        return results
    
    def display_summary(self, results: List[RecommendationResult]) -> None:
        """Display a comprehensive summary of the results."""
        if not results:
            print("❌ No results to display")
            return
        
        print("\n" + "="*80)
        print("📊 MULTI-REPOSITORY RECOMMENDATION GENERATION SUMMARY")
        print("="*80)
        
        # Calculate totals
        total_recommendations = sum(r.recommendations_count for r in results if r.success)
        successful_repos = len([r for r in results if r.success])
        failed_repos = len([r for r in results if not r.success])
        total_time = sum(r.generation_time for r in results)
        
        # Display overview
        print(f"\n📈 OVERVIEW:")
        print(f"   Total Repositories: {len(results)}")
        print(f"   Successful: {successful_repos}")
        print(f"   Failed: {failed_repos}")
        print(f"   Total Recommendations Generated: {total_recommendations}")
        print(f"   Total Processing Time: {total_time:.2f} seconds")
        print(f"   Average Time per Repository: {total_time/len(results):.2f} seconds")
        
        # Display metrics verification results if available
        if hasattr(self, 'verification_results') and self.verification_results:
            print(f"\n🔍 METRICS VERIFICATION:")
            repos_with_metrics = len([v for v in self.verification_results if v.get('metrics_populated', False)])
            total_verified = len(self.verification_results)
            total_recs_with_metrics = sum(v.get('recommendations_with_metrics', 0) for v in self.verification_results)
            total_verified_recs = sum(v.get('total_recommendations', 0) for v in self.verification_results)
            
            print(f"   Repositories with Metrics: {repos_with_metrics}/{total_verified}")
            print(f"   Recommendations with Metrics: {total_recs_with_metrics}/{total_verified_recs}")
            
            if total_verified_recs > 0:
                metrics_percentage = (total_recs_with_metrics / total_verified_recs) * 100
                print(f"   Metrics Coverage: {metrics_percentage:.1f}%")
        
        # Display detailed results
        print(f"\n📋 DETAILED RESULTS:")
        print("-" * 80)
        print(f"{'Repository Name':<35} {'Tech Stack':<20} {'Recs':<6} {'Status':<8} {'Time':<8}")
        print("-" * 80)
        
        for result in results:
            status = "✅ OK" if result.success else "❌ FAIL"
            print(f"{result.repository_name:<35} {result.tech_stack:<20} {result.recommendations_count:<6} {status:<8} {result.generation_time:.2f}s")
        
        # Display failures if any
        failed_results = [r for r in results if not r.success]
        if failed_results:
            print(f"\n❌ FAILURES ({len(failed_results)}):")
            print("-" * 80)
            for result in failed_results:
                print(f"   {result.repository_name}: {result.error_message}")
        
        # Display detailed metrics verification results
        if hasattr(self, 'verification_results') and self.verification_results:
            print(f"\n📊 DETAILED METRICS VERIFICATION:")
            print("-" * 80)
            print(f"{'Repository Name':<35} {'Total Recs':<10} {'With Metrics':<12} {'Status':<10}")
            print("-" * 80)
            
            for verification in self.verification_results:
                repo_name = verification.get('repository_name', 'Unknown')
                total_recs = verification.get('total_recommendations', 0)
                metrics_recs = verification.get('recommendations_with_metrics', 0)
                has_metrics = verification.get('metrics_populated', False)
                status = "✅ HAS METRICS" if has_metrics else "❌ NO METRICS"
                
                print(f"{repo_name:<35} {total_recs:<10} {metrics_recs:<12} {status:<10}")

        # Display top performers
        successful_results = [r for r in results if r.success]
        if successful_results:
            print(f"\n🏆 TOP PERFORMERS:")
            print("-" * 80)
            top_by_recommendations = sorted(successful_results, key=lambda x: x.recommendations_count, reverse=True)[:3]
            for i, result in enumerate(top_by_recommendations, 1):
                print(f"   {i}. {result.repository_name}: {result.recommendations_count} recommendations")
            
            print(f"\n⚡ FASTEST GENERATION:")
            print("-" * 80)
            fastest = sorted(successful_results, key=lambda x: x.generation_time)[:3]
            for i, result in enumerate(fastest, 1):
                print(f"   {i}. {result.repository_name}: {result.generation_time:.2f}s")
        
        print("\n" + "="*80)
        print("✅ Recommendation generation complete!")
        print("="*80)


def main():
    """Main execution function."""
    print("🚀 RefactorForge Multi-Repository Recommendation Generator")
    print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Initialize the generator
    generator = MultiRepositoryRecommendationGenerator()
    
    # Generate recommendations for all repositories
    results = generator.generate_all_recommendations()
    
    # Display comprehensive summary
    generator.display_summary(results)
    
    # Export results to JSON for further analysis
    export_data = {
        'timestamp': datetime.now().isoformat(),
        'total_repositories': len(results),
        'successful_generations': len([r for r in results if r.success]),
        'total_recommendations': sum(r.recommendations_count for r in results if r.success),
        'results': [
            {
                'repository_id': r.repository_id,
                'repository_name': r.repository_name,
                'tech_stack': r.tech_stack,
                'recommendations_count': r.recommendations_count,
                'success': r.success,
                'error_message': r.error_message,
                'generation_time': r.generation_time
            }
            for r in results
        ]
    }
    
    # Save results to file
    results_file = f"/Users/benreceveur/GitHub/RefactorForge/backend/recommendation_results_{int(time.time())}.json"
    try:
        with open(results_file, 'w') as f:
            json.dump(export_data, f, indent=2)
        print(f"📄 Results exported to: {results_file}")
    except Exception as e:
        print(f"⚠️  Could not export results: {e}")


if __name__ == "__main__":
    main()