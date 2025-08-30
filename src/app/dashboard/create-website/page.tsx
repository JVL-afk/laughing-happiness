// app/dashboard/create/page.tsx
// FIXED FRONTEND COMPONENT - Resolves 400 Bad Request errors

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  name: string;
  email: string;
  plan: string;
  websitesCreated: number;
  websiteLimit: number;
}

interface WebsiteData {
  id: string;
  title: string;
  headline: string;
  description: string;
  html: string;
  css: string;
  features: string[];
  cta: string;
  seoKeywords: string[];
  productUrl: string;
  createdAt: string;
}

export default function CreateWebsite() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [generatedWebsite, setGeneratedWebsite] = useState<WebsiteData | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    productUrl: '',
    niche: '',
    targetAudience: '',
    customization: {
      colorScheme: 'modern',
      style: 'professional',
      tone: 'persuasive'
    }
  });

  // Load user data on component mount
  useEffect(() => {
    loadUserData();
  }, []);

const loadUserData = async () => {
  try {
    // Try multiple token sources
    const token = localStorage.getItem('authToken') || 
                  localStorage.getItem('token') ||
                  document.cookie
                    .split('; ')
                    .find(row => row.startsWith('auth-token='))
                    ?.split('=')[1] ||
                  document.cookie
                    .split('; ')
                    .find(row => row.startsWith('token='))
                    ?.split('=')[1];
    
    if (!token) {
      console.log('No token found, redirecting to login');
      router.push('/login');
      return;
    }

    console.log('Token found, fetching user data...');

    const response = await fetch('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('User data response status:', response.status);

    if (response.ok) {
      const userData = await response.json();
      console.log('User data received:', userData);
      setUser(userData.user);
    } else {
      console.log('Failed to get user data, redirecting to login');
      router.push('/login');
    }
  } catch (error) {
    console.error('Error loading user data:', error);
    router.push('/login');
  }
};

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name.startsWith('customization.')) {
      const customizationField = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        customization: {
          ...prev.customization,
          [customizationField]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const validateForm = () => {
    if (!formData.productUrl) {
      setError('Product/Affiliate URL is required');
      return false;
    }

    // Validate URL format
    try {
      new URL(formData.productUrl);
    } catch {
      setError('Please enter a valid URL');
      return false;
    }

    // Check if user has reached limit
    if (user && user.websitesCreated >= user.websiteLimit) {
      setError(`You have reached your limit of ${user.websiteLimit} websites. Please upgrade your plan.`);
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

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        router.push('/login');
        return;
      }

      // Prepare request data
      const requestData = {
        productUrl: formData.productUrl.trim(),
        niche: formData.niche.trim() || undefined,
        targetAudience: formData.targetAudience.trim() || undefined,
        customization: formData.customization
      };

      console.log('Sending request:', requestData);

      const response = await fetch('/api/ai/generate-website', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();
      console.log('Response:', data);

      if (response.ok) {
        setSuccess('Website generated successfully! 🎉');
        setGeneratedWebsite(data.website);
        
        // Update user stats
        if (data.userStats) {
          setUser(prev => prev ? {
            ...prev,
            websitesCreated: data.userStats.websitesCreated
          } : null);
        }

        // Reset form
        setFormData({
          productUrl: '',
          niche: '',
          targetAudience: '',
          customization: {
            colorScheme: 'modern',
            style: 'professional',
            tone: 'persuasive'
          }
        });

      } else {
        setError(data.message || data.error || 'Failed to generate website');
        
        if (data.upgradeRequired) {
          // Show upgrade prompt
          setTimeout(() => {
            router.push('/pricing');
          }, 3000);
        }
      }

    } catch (error) {
      console.error('Error generating website:', error);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const previewWebsite = () => {
    if (!generatedWebsite) return;

    // Create a new window with the generated website
    const previewWindow = window.open('', '_blank');
    if (previewWindow) {
      previewWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${generatedWebsite.title}</title>
          <meta name="description" content="${generatedWebsite.description}">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>${generatedWebsite.css}</style>
        </head>
        <body>
          ${generatedWebsite.html}
        </body>
        </html>
      `);
      previewWindow.document.close();
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            🚀 Create New Website
          </h1>
          <p className="text-xl text-gray-300">
            Transform any affiliate link into a high-converting website with AI
          </p>
        </div>

        {/* User Stats */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-8 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Plan: {user.plan}</h3>
              <p className="text-gray-300">
                Websites: {user.websitesCreated}/{user.websiteLimit}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-400">
                {user.websiteLimit - user.websitesCreated}
              </div>
              <div className="text-sm text-gray-300">Remaining</div>
            </div>
            {user.websitesCreated >= user.websiteLimit && (
              <button
                onClick={() => router.push('/pricing')}
                className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-2 rounded-lg font-semibold hover:from-orange-600 hover:to-red-600 transition-all"
              >
                Upgrade for More
              </button>
            )}
          </div>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Website Generation Form */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-6">
              🎯 No BS Website Creation
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Product URL */}
              <div>
                <label className="block text-white font-semibold mb-2">
                  Product/Affiliate URL *
                </label>
                <input
                  type="url"
                  name="productUrl"
                  value={formData.productUrl}
                  onChange={handleInputChange}
                  placeholder="https://www.amazon.com/product-link"
                  className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <p className="text-sm text-gray-300 mt-1">
                  Just paste your affiliate link - our AI will handle the rest! 🧠
                </p>
              </div>

              {/* Niche (Optional) */}
              <div>
                <label className="block text-white font-semibold mb-2">
                  Niche/Category (Optional)
                </label>
                <input
                  type="text"
                  name="niche"
                  value={formData.niche}
                  onChange={handleInputChange}
                  placeholder="e.g., Fitness, Technology, Beauty (AI will detect if empty)"
                  className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Target Audience (Optional) */}
              <div>
                <label className="block text-white font-semibold mb-2">
                  Target Audience (Optional)
                </label>
                <textarea
                  name="targetAudience"
                  value={formData.targetAudience}
                  onChange={handleInputChange}
                  placeholder="AI will analyze your product and create perfect audience targeting..."
                  rows={3}
                  className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Customization Options */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-white font-semibold mb-2">Color Scheme</label>
                  <select
                    name="customization.colorScheme"
                    value={formData.customization.colorScheme}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="modern">Modern</option>
                    <option value="classic">Classic</option>
                    <option value="vibrant">Vibrant</option>
                    <option value="minimal">Minimal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-white font-semibold mb-2">Style</label>
                  <select
                    name="customization.style"
                    value={formData.customization.style}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="professional">Professional</option>
                    <option value="casual">Casual</option>
                    <option value="luxury">Luxury</option>
                    <option value="playful">Playful</option>
                  </select>
                </div>

                <div>
                  <label className="block text-white font-semibold mb-2">Tone</label>
                  <select
                    name="customization.tone"
                    value={formData.customization.tone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="persuasive">Persuasive</option>
                    <option value="informative">Informative</option>
                    <option value="friendly">Friendly</option>
                    <option value="authoritative">Authoritative</option>
                  </select>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || (user.websitesCreated >= user.websiteLimit)}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-lg font-bold text-lg hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                    Generating Your Website...
                  </div>
                ) : (
                  '🚀 Generate Website with AI'
                )}
              </button>
            </form>
          </div>

          {/* Generated Website Preview */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-6">
              🎉 Generated Website
            </h2>

            {generatedWebsite ? (
              <div className="space-y-4">
                <div className="bg-white/20 rounded-lg p-4">
                  <h3 className="text-xl font-bold text-white mb-2">
                    {generatedWebsite.title}
                  </h3>
                  <p className="text-gray-300 mb-4">
                    {generatedWebsite.description}
                  </p>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    {generatedWebsite.features.map((feature, index) => (
                      <span
                        key={index}
                        className="bg-blue-500/30 text-blue-200 px-3 py-1 rounded-full text-sm"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={previewWebsite}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-all"
                    >
                      👁️ Preview Website
                    </button>
                    <button
                      onClick={() => router.push('/dashboard')}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-all"
                    >
                      📊 View Dashboard
                    </button>
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-green-400 font-semibold">
                    🎮 Achievement Unlocked: Website Creator!
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-400">
                <div className="text-6xl mb-4">🎯</div>
                <p className="text-lg">
                  Your generated website will appear here
                </p>
                <p className="text-sm mt-2">
                  Fill out the form and click "Generate Website with AI"
                </p>
              </div>
            )}
          </div>
        </div>

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
