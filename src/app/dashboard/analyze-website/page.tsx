// app/dashboard/analyze-website/page.tsx
// FIXED FRONTEND COMPONENT - Resolves 400/500 errors

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface AnalysisResult {
  url: string;
  analyzedAt: string;
  analysisType: string;
  performance: {
    loadTime: number;
    metrics: any;
    score: number;
  };
  content: any;
  insights: {
    overallGrade: string;
    overallScore: number;
    performanceScore: number;
    seoScore: number;
    conversionScore: number;
    accessibilityScore: number;
    mobileScore: number;
    securityScore: number;
    summary: string;
    strengths: string[];
    weaknesses: string[];
    recommendations: Array<{
      category: string;
      priority: string;
      action: string;
      impact: string;
    }>;
    affiliateOptimization: {
      conversionPotential: string;
      trustSignals: string[];
      improvementAreas: string[];
      competitiveAdvantages: string[];
    };
    technicalIssues: string[];
    priorityActions: string[];
  };
  quickStats: {
    overallGrade: string;
    overallScore: number;
    loadTime: number;
    wordCount: number;
    seoScore: number;
    conversionScore: number;
  };
  achievements: string[];
}

export default function AnalyzeWebsite() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    websiteUrl: '',
    analysisType: 'comprehensive',
    includeCompetitorAnalysis: false
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const validateForm = () => {
    if (!formData.websiteUrl) {
      setError('Website URL is required');
      return false;
    }

    // Validate URL format
    try {
      new URL(formData.websiteUrl);
    } catch {
      setError('Please enter a valid URL (include http:// or https://)');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setAnalysisResult(null);

    try {
      // Prepare request data
      const requestData = {
        websiteUrl: formData.websiteUrl.trim(),
        analysisType: formData.analysisType,
        includeCompetitorAnalysis: formData.includeCompetitorAnalysis
      };

      console.log('Sending analysis request:', requestData);

      // Get auth token from cookies (matches middleware)
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth-token='))
        ?.split('=')[1] || 
        document.cookie
        .split('; ')
        .find(row => row.startsWith('token='))
        ?.split('=')[1] ||
        document.cookie
        .split('; ')
        .find(row => row.startsWith('authToken='))
        ?.split('=')[1] ||
        localStorage.getItem('authToken') ||
        localStorage.getItem('token');

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/ai/analyze-website', {
        method: 'POST',
        headers,
        body: JSON.stringify(requestData),
      });

      const data = await response.json();
      console.log('Analysis response:', data);

      if (response.ok) {
        setSuccess('Website analysis completed successfully! 🎉');
        setAnalysisResult(data.analysis);
      } else {
        setError(data.message || data.error || 'Failed to analyze website');
      }

    } catch (error) {
      console.error('Error analyzing website:', error);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-green-400';
      case 'B': return 'text-blue-400';
      case 'C': return 'text-yellow-400';
      case 'D': return 'text-orange-400';
      case 'F': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-400';
    if (score >= 80) return 'text-blue-400';
    if (score >= 70) return 'text-yellow-400';
    if (score >= 60) return 'text-orange-400';
    return 'text-red-400';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high': return 'bg-red-500/20 text-red-300 border-red-500';
      case 'medium': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500';
      case 'low': return 'bg-green-500/20 text-green-300 border-green-500';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            🔍 Website Performance Analyzer
          </h1>
          <p className="text-xl text-gray-300">
            Get comprehensive insights into your website's performance, accessibility, SEO, and best practices with our advanced analysis tool.
          </p>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-100 px-4 py-3 rounded-lg mb-6">
            <div className="flex items-center">
              <span className="text-red-400 mr-2">⚠️</span>
              {error}
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-500/20 border border-green-500 text-green-100 px-4 py-3 rounded-lg mb-6">
            <div className="flex items-center">
              <span className="text-green-400 mr-2">✅</span>
              {success}
            </div>
          </div>
        )}

        {/* Analysis Form */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20 mb-8">
          <h2 className="text-2xl font-bold text-white mb-6">
            🎯 Website URL to Analyze
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Website URL */}
              <div className="lg:col-span-2">
                <label className="block text-white font-semibold mb-2">
                  Website URL to Analyze *
                </label>
                <input
                  type="url"
                  name="websiteUrl"
                  value={formData.websiteUrl}
                  onChange={handleInputChange}
                  placeholder="https://www.amazon.com/Aroma-Housewares-ARC-914SBD-Cool-Touch-Stainless/dp/B007WQ9YNO"
                  className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Analysis Type */}
              <div>
                <label className="block text-white font-semibold mb-2">
                  Analysis Type
                </label>
                <select
                  name="analysisType"
                  value={formData.analysisType}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="basic">Basic Analysis</option>
                  <option value="comprehensive">Comprehensive Analysis</option>
                  <option value="seo">SEO Focused</option>
                  <option value="performance">Performance Focused</option>
                </select>
              </div>

              {/* Competitor Analysis */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="includeCompetitorAnalysis"
                  checked={formData.includeCompetitorAnalysis}
                  onChange={handleInputChange}
                  className="mr-3 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="text-white font-semibold">
                  Include Competitor Analysis (Pro Feature)
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-lg font-bold text-lg hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                  Analyzing Website...
                </div>
              ) : (
                '🔍 Analyze Website'
              )}
            </button>
          </form>
        </div>

        {/* Analysis Results */}
        {analysisResult && (
          <div className="space-y-8">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20 text-center">
                <div className={`text-3xl font-bold ${getGradeColor(analysisResult.quickStats.overallGrade)}`}>
                  {analysisResult.quickStats.overallGrade}
                </div>
                <div className="text-sm text-gray-300">Overall Grade</div>
              </div>
              
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20 text-center">
                <div className={`text-3xl font-bold ${getScoreColor(analysisResult.quickStats.overallScore)}`}>
                  {analysisResult.quickStats.overallScore}
                </div>
                <div className="text-sm text-gray-300">Overall Score</div>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20 text-center">
                <div className="text-3xl font-bold text-blue-400">
                  {analysisResult.quickStats.loadTime}ms
                </div>
                <div className="text-sm text-gray-300">Load Time</div>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20 text-center">
                <div className={`text-3xl font-bold ${getScoreColor(analysisResult.quickStats.seoScore)}`}>
                  {analysisResult.quickStats.seoScore}
                </div>
                <div className="text-sm text-gray-300">SEO Score</div>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20 text-center">
                <div className={`text-3xl font-bold ${getScoreColor(analysisResult.quickStats.conversionScore)}`}>
                  {analysisResult.quickStats.conversionScore}
                </div>
                <div className="text-sm text-gray-300">Conversion</div>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20 text-center">
                <div className="text-3xl font-bold text-purple-400">
                  {analysisResult.quickStats.wordCount}
                </div>
                <div className="text-sm text-gray-300">Words</div>
              </div>
            </div>

            {/* Achievements */}
            {analysisResult.achievements.length > 0 && (
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                <h3 className="text-xl font-bold text-white mb-4">🏆 Achievements Unlocked</h3>
                <div className="flex flex-wrap gap-3">
                  {analysisResult.achievements.map((achievement, index) => (
                    <span
                      key={index}
                      className="bg-yellow-500/20 text-yellow-300 px-4 py-2 rounded-full font-semibold border border-yellow-500"
                    >
                      {achievement}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Detailed Scores */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                <h4 className="text-lg font-bold text-white mb-3">⚡ Performance</h4>
                <div className={`text-4xl font-bold ${getScoreColor(analysisResult.insights.performanceScore)} mb-2`}>
                  {analysisResult.insights.performanceScore}
                </div>
                <div className="text-sm text-gray-300">
                  Load time: {analysisResult.performance.loadTime}ms
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                <h4 className="text-lg font-bold text-white mb-3">🔍 SEO</h4>
                <div className={`text-4xl font-bold ${getScoreColor(analysisResult.insights.seoScore)} mb-2`}>
                  {analysisResult.insights.seoScore}
                </div>
                <div className="text-sm text-gray-300">Search optimization</div>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                <h4 className="text-lg font-bold text-white mb-3">💰 Conversion</h4>
                <div className={`text-4xl font-bold ${getScoreColor(analysisResult.insights.conversionScore)} mb-2`}>
                  {analysisResult.insights.conversionScore}
                </div>
                <div className="text-sm text-gray-300">Sales potential</div>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                <h4 className="text-lg font-bold text-white mb-3">♿ Accessibility</h4>
                <div className={`text-4xl font-bold ${getScoreColor(analysisResult.insights.accessibilityScore)} mb-2`}>
                  {analysisResult.insights.accessibilityScore}
                </div>
                <div className="text-sm text-gray-300">User accessibility</div>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                <h4 className="text-lg font-bold text-white mb-3">📱 Mobile</h4>
                <div className={`text-4xl font-bold ${getScoreColor(analysisResult.insights.mobileScore)} mb-2`}>
                  {analysisResult.insights.mobileScore}
                </div>
                <div className="text-sm text-gray-300">Mobile experience</div>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                <h4 className="text-lg font-bold text-white mb-3">🔒 Security</h4>
                <div className={`text-4xl font-bold ${getScoreColor(analysisResult.insights.securityScore)} mb-2`}>
                  {analysisResult.insights.securityScore}
                </div>
                <div className="text-sm text-gray-300">Security measures</div>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <h3 className="text-xl font-bold text-white mb-4">📋 Analysis Summary</h3>
              <p className="text-gray-300 text-lg leading-relaxed">
                {analysisResult.insights.summary}
              </p>
            </div>

            {/* Strengths and Weaknesses */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                <h3 className="text-xl font-bold text-green-400 mb-4">✅ Strengths</h3>
                <ul className="space-y-2">
                  {analysisResult.insights.strengths.map((strength, index) => (
                    <li key={index} className="text-gray-300 flex items-start">
                      <span className="text-green-400 mr-2">•</span>
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                <h3 className="text-xl font-bold text-red-400 mb-4">⚠️ Areas for Improvement</h3>
                <ul className="space-y-2">
                  {analysisResult.insights.weaknesses.map((weakness, index) => (
                    <li key={index} className="text-gray-300 flex items-start">
                      <span className="text-red-400 mr-2">•</span>
                      {weakness}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Priority Actions */}
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <h3 className="text-xl font-bold text-white mb-4">🎯 Priority Actions</h3>
              <div className="space-y-3">
                {analysisResult.insights.priorityActions.map((action, index) => (
                  <div key={index} className="bg-white/10 rounded-lg p-4 border border-white/20">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-semibold">
                        {index + 1}. {action}
                      </span>
                      <span className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-sm border border-blue-500">
                        Action Required
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Detailed Recommendations */}
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <h3 className="text-xl font-bold text-white mb-4">💡 Detailed Recommendations</h3>
              <div className="space-y-4">
                {analysisResult.insights.recommendations.map((rec, index) => (
                  <div key={index} className="bg-white/10 rounded-lg p-4 border border-white/20">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-lg font-semibold text-white">{rec.category}</h4>
                      <span className={`px-3 py-1 rounded-full text-sm border ${getPriorityColor(rec.priority)}`}>
                        {rec.priority} Priority
                      </span>
                    </div>
                    <p className="text-gray-300 mb-2">{rec.action}</p>
                    <p className="text-blue-300 text-sm">Expected Impact: {rec.impact}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Affiliate Optimization */}
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <h3 className="text-xl font-bold text-white mb-4">💰 Affiliate Marketing Optimization</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-lg font-semibold text-green-400 mb-3">
                    Conversion Potential: {analysisResult.insights.affiliateOptimization.conversionPotential}
                  </h4>
                  
                  <div className="mb-4">
                    <h5 className="font-semibold text-white mb-2">Trust Signals:</h5>
                    <ul className="space-y-1">
                      {analysisResult.insights.affiliateOptimization.trustSignals.map((signal, index) => (
                        <li key={index} className="text-gray-300 flex items-start">
                          <span className="text-green-400 mr-2">✓</span>
                          {signal}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div>
                  <div className="mb-4">
                    <h5 className="font-semibold text-white mb-2">Improvement Areas:</h5>
                    <ul className="space-y-1">
                      {analysisResult.insights.affiliateOptimization.improvementAreas.map((area, index) => (
                        <li key={index} className="text-gray-300 flex items-start">
                          <span className="text-yellow-400 mr-2">⚡</span>
                          {area}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h5 className="font-semibold text-white mb-2">Competitive Advantages:</h5>
                    <ul className="space-y-1">
                      {analysisResult.insights.affiliateOptimization.competitiveAdvantages.map((advantage, index) => (
                        <li key={index} className="text-gray-300 flex items-start">
                          <span className="text-blue-400 mr-2">🚀</span>
                          {advantage}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Back to Dashboard */}
        <div className="text-center mt-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-blue-400 hover:text-blue-300 font-semibold"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
