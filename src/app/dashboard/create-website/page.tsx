// src/app/dashboard/create-website/page.tsx
// OBJECTID-BASED CREATE-WEBSITE PAGE - Frontend ObjectID Authentication

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface WebsiteData {
  id: string;
  title: string;
  description: string;
  content: {
    hero: {
      headline: string;
      subheadline: string;
      ctaText: string;
    };
    features: string[];
    testimonials: Array<{
      name: string;
      text: string;
      rating: number;
    }>;
  };
}

export default function CreateWebsitePage() {
  const router = useRouter();
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
      // Get ObjectID for authentication (required for website creation)
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

      if (!userObjectId) {
        setError('Authentication required. Please log in again.');
        setTimeout(() => router.push('/login'), 2000);
        return;
      }

      console.log('🔍 CREATE: Using ObjectID for authentication:', userObjectId.substring(0, 8) + '...');

      // Prepare request data
      const requestData = {
        productUrl: formData.productUrl.trim(),
        niche: formData.niche.trim() || undefined,
        targetAudience: formData.targetAudience.trim() || undefined,
        customization: formData.customization
      };

      console.log('🔍 CREATE: Sending request:', requestData);

      const response = await fetch('/api/ai/generate-website', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userObjectId}`,
        },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          setError('Authentication required. Please log in again.');
          setTimeout(() => router.push('/login'), 2000);
          return;
        }
        
        if (response.status === 403) {
          setError(data.message || 'Website limit reached. Please upgrade your plan.');
          return;
        }
        
        throw new Error(data.error || data.message || 'Failed to generate website');
      }

      console.log('🔍 CREATE: Website generated successfully');
      setGeneratedWebsite(data.website);
      setSuccess(data.message || 'Website generated successfully!');

      // Store ObjectID in localStorage for future requests
      if (data.website?.createdBy) {
        localStorage.setItem('userObjectId', userObjectId);
      }

    } catch (error) {
      console.error('🔍 CREATE ERROR:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate website');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl">
          <h1 className="text-4xl font-bold text-white mb-2">Create Affiliate Website</h1>
          <p className="text-white/80 mb-8">
            Generate a professional affiliate marketing website powered by AI in minutes.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="productUrl" className="block text-white font-medium mb-2">
                Product/Affiliate URL *
              </label>
              <input
                type="url"
                id="productUrl"
                name="productUrl"
                value={formData.productUrl}
                onChange={handleInputChange}
                placeholder="https://example.com/product"
                className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-blue-400"
                disabled={loading}
                required
              />
            </div>

            <div>
              <label htmlFor="niche" className="block text-white font-medium mb-2">
                Niche/Category (Optional)
              </label>
              <input
                type="text"
                id="niche"
                name="niche"
                value={formData.niche}
                onChange={handleInputChange}
                placeholder="e.g., Fitness, Technology, Fashion"
                className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-blue-400"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="targetAudience" className="block text-white font-medium mb-2">
                Target Audience (Optional)
              </label>
              <input
                type="text"
                id="targetAudience"
                name="targetAudience"
                value={formData.targetAudience}
                onChange={handleInputChange}
                placeholder="e.g., Young professionals, Parents, Students"
                className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-blue-400"
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="colorScheme" className="block text-white font-medium mb-2">
                  Color Scheme
                </label>
                <select
                  id="colorScheme"
                  name="customization.colorScheme"
                  value={formData.customization.colorScheme}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                  disabled={loading}
                >
                  <option value="modern">Modern</option>
                  <option value="classic">Classic</option>
                  <option value="vibrant">Vibrant</option>
                  <option value="minimal">Minimal</option>
                </select>
              </div>

              <div>
                <label htmlFor="style" className="block text-white font-medium mb-2">
                  Style
                </label>
                <select
                  id="style"
                  name="customization.style"
                  value={formData.customization.style}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                  disabled={loading}
                >
                  <option value="professional">Professional</option>
                  <option value="casual">Casual</option>
                  <option value="luxury">Luxury</option>
                  <option value="playful">Playful</option>
                </select>
              </div>

              <div>
                <label htmlFor="tone" className="block text-white font-medium mb-2">
                  Tone
                </label>
                <select
                  id="tone"
                  name="customization.tone"
                  value={formData.customization.tone}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                  disabled={loading}
                >
                  <option value="persuasive">Persuasive</option>
                  <option value="informative">Informative</option>
                  <option value="friendly">Friendly</option>
                  <option value="authoritative">Authoritative</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
                <p className="text-red-200">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4">
                <p className="text-green-200">{success}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Generating Website...' : 'Generate Website'}
            </button>
          </form>

          {generatedWebsite && (
            <div className="mt-8 space-y-6">
              <div className="bg-white/10 rounded-lg p-6">
                <h2 className="text-2xl font-bold text-white mb-4">Generated Website Preview</h2>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="text-white font-semibold">Title</h3>
                    <p className="text-white/80">{generatedWebsite.title}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-white font-semibold">Description</h3>
                    <p className="text-white/80">{generatedWebsite.description}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-white font-semibold">Hero Section</h3>
                    <div className="bg-white/5 rounded p-4 space-y-2">
                      <p className="text-white font-medium">{generatedWebsite.content.hero.headline}</p>
                      <p className="text-white/70">{generatedWebsite.content.hero.subheadline}</p>
                      <button className="bg-blue-500 text-white px-4 py-2 rounded">
                        {generatedWebsite.content.hero.ctaText}
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-white font-semibold">Features</h3>
                    <ul className="space-y-1">
                      {generatedWebsite.content.features.map((feature, index) => (
                        <li key={index} className="text-white/80 flex items-start">
                          <span className="text-green-400 mr-2">✓</span>
                          {feature}
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

