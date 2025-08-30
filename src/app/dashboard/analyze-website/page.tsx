// src/app/dashboard/analyze-website/page.tsx
// OBJECTID-BASED ANALYZE-WEBSITE PAGE - Frontend ObjectID Authentication

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface AnalysisResult {
  url: string;
  domain: string;
  seoScore: number;
  performanceScore: number;
  recommendations: string[];
  keyInsights: {
    primaryTopic: string;
    targetAudience: string;
    contentQuality: string;
    competitorAnalysis: string;
  };
}

export default function AnalyzeWebsitePage() {
  const router = useRouter();
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [analysisType, setAnalysisType] = useState('basic');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const validateUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!websiteUrl.trim()) {
      setError('Please enter a website URL');
      return;
    }

    if (!validateUrl(websiteUrl)) {
      setError('Please enter a valid URL (include http:// or https://)');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      // Get ObjectID for authentication (optional for analysis)
      let userObjectId = localStorage.getItem('userObjectId') || 
                         localStorage.getItem('userId') ||
                         localStorage.getItem('objectId');
      
      // Try cookies if no localStorage ObjectID
      if (!userObjectId) {
        userObjectId = document.cookie
          .split('; ')
          .find(row => row.startsWith('user-id='))
          ?.split('=')[1] ||
        document.cookie
          .split('; ')
          .find(row => row.startsWith('auth-id='))
          ?.split('=')[1] ||
        document.cookie
          .split('; ')
          .find(row => row.startsWith('userId='))
          ?.split('=')[1];
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (userObjectId) {
        headers['Authorization'] = `Bearer ${userObjectId}`;
        console.log('🔍 ANALYZE: Sending ObjectID for authentication:', userObjectId.substring(0, 8) + '...');
      } else {
        console.log('🔍 ANALYZE: No ObjectID found - proceeding without authentication');
      }

      const requestData = {
        websiteUrl: websiteUrl.trim(),
        analysisType
      };

      console.log('🔍 ANALYZE: Sending analysis request:', requestData);

      const response = await fetch('/api/ai/analyze-website', {
        method: 'POST',
        headers,
        body: JSON.stringify(requestData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Analysis failed');
      }

      console.log('🔍 ANALYZE: Analysis completed successfully');
      setResult(data.analysis);

    } catch (error) {
      console.error('🔍 ANALYZE ERROR:', error);
      setError(error instanceof Error ? error.message : 'Failed to analyze website');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl">
          <h1 className="text-4xl font-bold text-white mb-2">Website Analyzer</h1>
          <p className="text-white/80 mb-8">
            Get detailed insights about any website's performance, SEO, and optimization opportunities.
          </p>

          <form onSubmit={handleAnalyze} className="space-y-6">
            <div>
              <label htmlFor="websiteUrl" className="block text-white font-medium mb-2">
                Website URL
              </label>
              <input
                type="url"
                id="websiteUrl"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-blue-400"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="analysisType" className="block text-white font-medium mb-2">
                Analysis Type
              </label>
              <select
                id="analysisType"
                value={analysisType}
                onChange={(e) => setAnalysisType(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                disabled={loading}
              >
                <option value="basic">Basic Analysis</option>
                <option value="detailed">Detailed Analysis</option>
                <option value="competitor">Competitor Analysis</option>
              </select>
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
                <p className="text-red-200">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Analyzing...' : 'Analyze Website'}
            </button>
          </form>

          {result && (
            <div className="mt-8 space-y-6">
              <div className="bg-white/10 rounded-lg p-6">
                <h2 className="text-2xl font-bold text-white mb-4">Analysis Results</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="bg-green-500/20 rounded-lg p-4">
                    <h3 className="text-white font-semibold">SEO Score</h3>
                    <p className="text-3xl font-bold text-green-400">{result.seoScore}/100</p>
                  </div>
                  <div className="bg-blue-500/20 rounded-lg p-4">
                    <h3 className="text-white font-semibold">Performance Score</h3>
                    <p className="text-3xl font-bold text-blue-400">{result.performanceScore}/100</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-white font-semibold mb-2">Key Insights</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-white/80">
                      <p><strong>Primary Topic:</strong> {result.keyInsights.primaryTopic}</p>
                      <p><strong>Target Audience:</strong> {result.keyInsights.targetAudience}</p>
                      <p><strong>Content Quality:</strong> {result.keyInsights.contentQuality}</p>
                      <p><strong>Competition:</strong> {result.keyInsights.competitorAnalysis}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-white font-semibold mb-2">Recommendations</h3>
                    <ul className="space-y-2">
                      {result.recommendations.map((rec, index) => (
                        <li key={index} className="text-white/80 flex items-start">
                          <span className="text-green-400 mr-2">•</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

