import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Video, Users, Globe2, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type Gender = 'male' | 'female' | 'both';
type Region = 'TR' | 'US' | 'global';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { setUser, setPreferences } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [gender, setGender] = useState<Gender>('both');
  const [region, setRegion] = useState<Region>('global');

  const handleLogin = (provider: string) => {
    console.log(`Login attempted with ${provider}`);
    const fakeUser = {
      id: 'test-user-id',
      email: `${provider}@example.com`,
      aud: 'authenticated',
      role: 'authenticated',
      email_confirmed_at: new Date().toISOString(),
      phone: '',
      confirmed_at: new Date().toISOString(),
      last_sign_in_at: new Date().toISOString(),
      app_metadata: { provider },
      user_metadata: {},
      identities: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setPreferences({ gender, region });
    setUser(fakeUser);
    navigate('/chat');
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-900 to-slate-800 lg:flex-row">
      {/* Left Section */}
      <div className="relative flex w-full items-center justify-center p-8 lg:w-1/2">
        <div className="relative z-10 text-center">
          <div className="mb-6 flex items-center justify-center">
            <Video className="mr-2 h-12 w-12 text-indigo-400" />
            <h1 className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-4xl font-bold text-transparent">
              VideoConnect
            </h1>
          </div>
          <p className="mb-8 text-xl font-light text-gray-300">
            Connect instantly. Chat freely. Meet the world.
          </p>
          <div className="flex flex-col space-y-4">
            <button
              onClick={() => setShowLoginModal(true)}
              className="rounded-lg bg-indigo-600 px-8 py-3 text-lg font-medium text-white transition-all hover:bg-indigo-700"
            >
              Sign In
            </button>
            <button
              onClick={() => setShowLoginModal(true)}
              className="rounded-lg border border-indigo-400/30 bg-white/5 px-8 py-3 text-lg font-medium text-white backdrop-blur-sm transition-all hover:bg-white/10"
            >
              Start Video Chat
            </button>
          </div>
        </div>

        {/* Background Decorations */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -left-4 top-1/4 h-64 w-64 rotate-12 rounded-full bg-indigo-600/10 blur-3xl" />
          <div className="absolute bottom-1/3 right-1/4 h-96 w-96 -rotate-12 rounded-full bg-purple-600/10 blur-3xl" />
        </div>
      </div>

      {/* Right Section */}
      <div className="relative flex w-full items-center justify-center bg-black/20 p-8 backdrop-blur-sm lg:w-1/2">
        <button className="absolute right-4 top-4 rounded-lg bg-white/10 p-2 text-white backdrop-blur-sm transition-all hover:bg-white/20">
          <Menu className="h-6 w-6" />
        </button>

        <div className="w-full max-w-md space-y-8">
          {/* Stats */}
          <div className="flex items-center justify-center space-x-2 text-center text-white">
            <Users className="h-5 w-5" />
            <span className="text-xl font-semibold">
              <span className="text-indigo-400">12,457</span> users online
            </span>
          </div>

          {/* Filters */}
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">I want to meet</label>
              <div className="flex rounded-lg bg-white/10 p-1">
                {(['male', 'female', 'both'] as const).map((option) => (
                  <button
                    key={option}
                    onClick={() => setGender(option)}
                    className={`flex-1 rounded-md py-2 text-sm font-medium capitalize transition-all ${
                      gender === option
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-300 hover:text-white'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">Region</label>
              <div className="flex rounded-lg bg-white/10 p-1">
                {(['TR', 'US', 'global'] as const).map((option) => (
                  <button
                    key={option}
                    onClick={() => setRegion(option)}
                    className={`flex-1 rounded-md py-2 text-sm font-medium uppercase transition-all ${
                      region === option
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-300 hover:text-white'
                    }`}
                  >
                    {option === 'global' ? <Globe2 className="mx-auto h-5 w-5" /> : option}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Start Button */}
          <button
            onClick={() => setShowLoginModal(true)}
            className="w-full rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 py-4 text-lg font-semibold text-white transition-all hover:from-indigo-700 hover:to-purple-700"
          >
            Start Video Chat
          </button>
        </div>
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-gray-900">Sign In</h2>
              <button
                onClick={() => setShowLoginModal(false)}
                className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              {[
                { provider: 'Google', color: 'bg-red-500' },
                { provider: 'Facebook', color: 'bg-blue-600' },
                { provider: 'Apple', color: 'bg-gray-900' },
              ].map(({ provider, color }) => (
                <button
                  key={provider}
                  onClick={() => handleLogin(provider.toLowerCase())}
                  className={`flex w-full items-center justify-center rounded-lg ${color} py-3 text-white transition-all hover:opacity-90`}
                >
                  Continue with {provider}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};