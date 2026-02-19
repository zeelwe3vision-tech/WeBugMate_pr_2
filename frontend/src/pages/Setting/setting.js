import React, { useContext, useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Modal } from 'react-bootstrap';
import { MyContext } from "../../App";
import { FaUser, FaCode, FaCheck, FaTimes, FaSpinner, FaSignOutAlt } from "react-icons/fa";
import "./setting.css";
import { supabase, databaseService } from "../../services/supabase";
import avt1 from './avtar/avt1.jpeg';
import avt2 from './avtar/avt2.jpeg';
import avt3 from './avtar/avt3.jpeg';
import avt4 from './avtar/avt4.jpeg';
import avt5 from './avtar/avt5.jpeg';
import avt6 from './avtar/avt6.jpeg';

const Setting = () => {
  const context = useContext(MyContext);
  const contentRef = useRef(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  // udit start
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const modelDropdownRef = useRef(null);
  // udit end

  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection = searchParams.get('tab') || 'profile';
  const [avatarPreview, setAvatarPreview] = useState(context.userPhotoURL || null);
  const [uploadStatus, setUploadStatus] = useState({ success: null, message: '' });
  const [formData, setFormData] = useState({
    fullName: context.username || '',
    email: context.userEmail || '',
    role: 'Developer',
    bio: ''
  });
  const [llmModel, setLlmModel] = useState("openai/gpt-4o-mini");
  const [isSavingModel, setIsSavingModel] = useState(false);
  const [llmSaveStatus, setLlmSaveStatus] = useState({ success: null, message: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState({ success: null, message: '' });
  // Avatar picker (predefined) instead of file upload
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const predefinedAvatars = [avt1, avt2, avt3, avt4, avt5, avt6];

  const [isAiModelOpen, setIsAiModelOpen] = useState(false);
  const aiModelDropdownRef = useRef(null);


  // Fetch user's avatar when component mounts
  useEffect(() => {
    const fetchUserAvatar = async () => {
      try {
        if (!context.userId && !context.userEmail) {
          console.log('No user ID or email available to fetch avatar');
          return;
        }

        // Try to get from profiles table first (using user ID)
        if (context.userId) {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', context.userId)
            .single();

          if (!profileError && profileData?.avatar_url) {
            setAvatarPreview(profileData.avatar_url);
            if (context.setUserPhotoURL) {
              context.setUserPhotoURL(profileData.avatar_url);
            }
            return;
          }
        }

        // Fallback to user_profiles table (using email)
        if (context.userEmail) {
          const { data: userProfileData, error: userProfileError } = await supabase
            .from('user_profiles')
            .select('avatar_url')
            .eq('email', context.userEmail)
            .single();

          if (!userProfileError && userProfileData?.avatar_url) {
            setAvatarPreview(userProfileData.avatar_url);
            if (context.setUserPhotoURL) {
              context.setUserPhotoURL(userProfileData.avatar_url);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching user avatar:', error);
      }
    };

    fetchUserAvatar();
  }, [context.userId, context.userEmail, context.setUserPhotoURL]);

  // udit start
  // Click outside handler for model dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target)) {
        setIsModelDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  // udit end

  // Fetch LLM Settings
  useEffect(() => {
    const fetchLlmSettings = async () => {
      if (!context.userEmail) return;
      try {
        const res = await fetch(`https://zeelsheta-webugmate-backend-pr-2-1.hf.space/api/llm/active?email=${context.userEmail}`, {
          headers: {
            "Authorization": "Bearer webugmate123",
            "user_email": context.userEmail
          }
        });
        if (res.ok) {
          const data = await res.json();
          console.log("📥 Fetched LLM Settings:", data);
          if (data.llm_model) setLlmModel(data.llm_model);
        }
      } catch (e) { console.error("Error fetching LLM settings:", e); }
    };
    fetchLlmSettings();
  }, [context.userEmail]);

  const handleSaveLlmSettings = async () => {
    setIsSavingModel(true);
    setLlmSaveStatus({ success: null, message: '' });
    try {
      const res = await fetch('https://zeelsheta-webugmate-backend-pr-2-1.hf.space/api/llm/select', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          "Authorization": "Bearer webugmate123",
          "user_email": context.userEmail
        },
        body: JSON.stringify({
          email: context.userEmail,
          model: llmModel,
          user_id: context.userId
        })
      });
      if (res.ok) {
        setLlmSaveStatus({ success: true, message: 'AI Model updated successfully!' });
        setTimeout(() => setLlmSaveStatus({ success: null, message: '' }), 3000);
      } else {
        const errorData = await res.json();
        setLlmSaveStatus({ success: false, message: errorData.error || 'Failed to update model.' });
      }
    } catch (e) {
      console.error("Error updating LLM settings:", e);
      setLlmSaveStatus({ success: false, message: `Error updating model: ${e.message}` });
    } finally {
      setIsSavingModel(false);
    }
  };

  const handleSelectPredefinedAvatar = async (url) => {
    try {
      setUploadStatus({ success: null, message: 'Updating avatar...', timestamp: Date.now() });

      const updates = [];
      const timestamp = new Date().toISOString();

      // Update `profiles` table if userId is present
      if (context.userId) {
        updates.push(
          supabase
            .from('profiles')
            .upsert({
              id: context.userId,
              avatar_url: url,
              updated_at: timestamp,
              email: context.userEmail || formData.email,
              full_name: formData.fullName || '',
            }, { onConflict: 'id' })
        );
      }

      // ALWAYS try to update `user_profiles` if email is present
      if (formData.email || context.userEmail) {
        const targetEmail = formData.email || context.userEmail;
        // Check existence first to avoid PK/Unique constraint issues with upsert
        const { data: existingUser } = await supabase
          .from('user_profiles')
          .select('email') // Changed from id to email
          .eq('email', targetEmail)
          .maybeSingle();

        if (existingUser) {
          updates.push(
            supabase
              .from('user_profiles')
              .update({
                full_name: formData.fullName || '',
                role: formData.role || 'Developer',
                bio: formData.bio || '',
                avatar_url: url,
                updated_at: timestamp
              })
              .eq('email', targetEmail)
          );
        } else {
          updates.push(
            supabase
              .from('user_profiles')
              .insert({
                email: targetEmail,
                full_name: formData.fullName || '',
                role: formData.role || 'Developer',
                bio: formData.bio || '',
                avatar_url: url,
                updated_at: timestamp
              })
          );
        }
      }

      const results = await Promise.allSettled(updates);
      const failed = results.filter(r => r.status === 'rejected' || r.value.error);

      if (failed.length === updates.length && updates.length > 0) {
        // All attempts failed
        throw failed[0].reason || failed[0].value.error;
      }

      setAvatarPreview(url);
      if (context.setUserPhotoURL) context.setUserPhotoURL(url);
      setUploadStatus({ success: true, message: 'Avatar updated!', timestamp: Date.now() });
    } catch (e) {
      // Still set locally even if DB update fails
      setAvatarPreview(url);
      if (context.setUserPhotoURL) context.setUserPhotoURL(url);
      setUploadStatus({ success: true, message: 'Avatar updated locally.', timestamp: Date.now() });
      console.error('Avatar update error:', e);
    } finally {
      setShowAvatarPicker(false);
    }
  };

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [activeSection]);

  const settingsSections = [
    {
      id: "profile",
      title: "Profile Settings",
      icon: <FaUser />,
      description: "Manage your profile information and preferences",
    },
    {
      id: "api-management",
      title: "API Management",
      icon: <FaCode />,
      description: "Manage API keys and endpoints",
    },
  ];

  // Helper: build a storage key unique per user
  const getProfileStorageKey = (email, userId) => {
    if (userId) return `userProfile:uid:${userId}`;
    if (email) return `userProfile:email:${email.toLowerCase()}`;
    let guestId = localStorage.getItem('guestProfileId');
    if (!guestId) {
      guestId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem('guestProfileId', guestId);
    }
    return `userProfile:${guestId}`;
  };


  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAvatarChange = async (e) => {
    const file = e?.target?.files?.[0];

    if (!file) {
      setUploadStatus({
        success: false,
        message: 'No file selected. Please choose an image to upload.',
        timestamp: Date.now()
      });
      return;
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setUploadStatus({
        success: false,
        message: 'Invalid file type. Please upload an image (JPEG, PNG, GIF, or WebP).',
        timestamp: Date.now()
      });
      return;
    }

    // Validate file size (max 2MB)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      console.error('Upload error:', 'File is too large. Maximum size is 2MB.');
      return;
    }

    // Create preview immediately for better UX
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);

    try {
      setUploadStatus({ success: null, message: 'Uploading...', timestamp: Date.now() });

      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${context.userId || 'anonymous'}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get public URL with cache buster
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Add timestamp to force cache refresh
      const timestamp = new Date().getTime();
      const finalUrl = `${publicUrl}?t=${timestamp}`;

      // Update user's avatar URL in the database
      const isoTimestamp = new Date().toISOString();
      const updates = [];

      // Update `profiles` using upsert if userId exists
      if (context.userId) {
        updates.push(
          supabase
            .from('profiles')
            .upsert({
              id: context.userId,
              avatar_url: finalUrl,
              updated_at: isoTimestamp,
              email: context.userEmail || formData.email,
              full_name: formData.fullName || ''
            }, { onConflict: 'id' })
        );
      }

      // Update `user_profiles` checking existence first
      if (formData.email || context.userEmail) {
        const targetEmail = formData.email || context.userEmail;
        const { data: existingUser } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('email', targetEmail)
          .maybeSingle();

        if (existingUser) {
          updates.push(
            supabase
              .from('user_profiles')
              .update({
                avatar_url: finalUrl,
                full_name: formData.fullName || '',
                updated_at: isoTimestamp
              })
              .eq('email', targetEmail)
          );
        } else {
          updates.push(
            supabase
              .from('user_profiles')
              .insert({
                email: targetEmail,
                avatar_url: finalUrl,
                full_name: formData.fullName || '',
                updated_at: isoTimestamp
              })
          );
        }
      }

      const results = await Promise.allSettled(updates);
      const failed = results.filter(r => r.status === 'rejected' || r.value.error);

      if (failed.length === updates.length && updates.length > 0) {
        throw failed[0].reason || failed[0].value.error;
      }

      // Update context/state with the new avatar URL
      if (context.setUserPhotoURL) {
        context.setUserPhotoURL(finalUrl);
      }

      setUploadStatus({
        success: true,
        message: 'Avatar updated successfully!',
        timestamp: Date.now()
      });

      // Update context if needed
      if (context.setUserPhotoURL) {
        context.setUserPhotoURL(publicUrl);
      }

    } catch (error) {
      console.error('Error uploading avatar:', error);
      setUploadStatus({
        success: false,
        message: 'Failed to upload avatar. Please try again.'
      });
    } finally {
      // Reset file input to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleSaveChanges = async () => {
    if (!formData.fullName.trim()) {
      setSaveStatus({ success: false, message: 'Full name is required' });
      return;
    }

    setIsSaving(true);
    setSaveStatus({ success: null, message: '' });

    try {
      console.log('Starting to save settings...');

      const currentUser = context;
      const userId = currentUser.userId || context.userId;
      const userEmail = currentUser.userEmail || formData.email || '';
      const avatarUrl = avatarPreview || context.userPhotoURL || '';

      const profileData = {
        ...(userId ? { id: userId } : {}),
        email: userEmail,
        full_name: formData.fullName.trim(),
        role: formData.role?.trim() || 'Developer',
        bio: formData.bio?.trim() || '',
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString()
      };

      console.log('Saving profile data:', profileData);

      let savedData;

      if (userId) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .upsert({
              id: userId,
              ...profileData
            }, { onConflict: 'id' })
            .select()
            .single();

          if (error) throw error;
          console.log('Successfully saved to profiles table:', data);
          savedData = data;
        } catch (idErr) {
          console.error('Error updating profiles table (continuing to user_profiles):', idErr);
        }
      }

      if (userEmail) {
        try {
          const userProfilePayload = {
            user_id: userId,
            email: userEmail,
            full_name: formData.fullName.trim(),
            role: formData.role?.trim() || 'Developer',
            bio: formData.bio?.trim() || '',
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString()
          };

          const { data: existingUser } = await supabase
            .from('user_profiles')
            .select('email')
            .eq('email', userEmail)
            .maybeSingle();

          let upRes;
          if (existingUser) {
            upRes = await supabase
              .from('user_profiles')
              .update(userProfilePayload)
              .eq('email', userEmail)
              .select()
              .single();
          } else {
            upRes = await supabase
              .from('user_profiles')
              .insert(userProfilePayload)
              .select()
              .single();
          }

          if (upRes.error) {
            console.error('Error updating user_profiles:', upRes.error);
          } else {
            console.log('Successfully saved to user_profiles table:', upRes.data);
            savedData = savedData || upRes.data;
          }
        } catch (upErr) {
          console.error('Exception updating user_profiles:', upErr);
        }
      }

      if (!userId && !userEmail) {
        const storageKey = getProfileStorageKey('', null);
        localStorage.setItem(storageKey, JSON.stringify(profileData));
        setSaveStatus({ success: true, message: 'Profile saved locally!' });
      }

      if (context.setUsername) context.setUsername(profileData.full_name);
      if (context.setUserPhotoURL && avatarUrl) context.setUserPhotoURL(avatarUrl);

      try {
        const savedUser = sessionStorage.getItem('authUser');
        if (savedUser) {
          const userData = JSON.parse(savedUser);
          userData.name = profileData.full_name;
          userData.photoURL = avatarUrl;
          sessionStorage.setItem('authUser', JSON.stringify(userData));
        }
      } catch (e) {
        console.error('Error updating session storage:', e);
      }

      setSaveStatus({
        success: true,
        message: 'Profile updated successfully!'
      });

      setTimeout(() => {
        setSaveStatus({ success: null, message: '' });
      }, 3000);

    } catch (error) {
      console.error('Error saving profile:', error);
      setSaveStatus({
        success: false,
        message: error.message || 'Failed to update profile. Please try again.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      fullName: context.username || '',
      email: context.userEmail || '',
      role: 'Developer',
      bio: ''
    });
    setSaveStatus({ success: null, message: '' });
  };

  const handleManageKeys = () => {
    alert("Opening API Keys manager...");
  };


  const handleViewDocs = () => {
    window.open("https://example.com/docs", "_blank");
  };

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        console.log('Loading user profile...');
        const userId = context.user?.uid;
        if (userId) {
          const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', userId)
            .single();
          if (!error && data) {
            setFormData({
              fullName: data.full_name || '',
              email: data.email || '',
              role: data.role || 'Developer',
              bio: data.bio || ''
            });
            if (data.avatar_url) {
              setAvatarPreview(data.avatar_url);
            }
            return;
          }
        }
        const fallbackEmail = (context.userEmail || formData.email || '').trim();
        if (fallbackEmail) {
          const { data: guestData, error: guestErr } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('email', fallbackEmail)
            .single();
          if (!guestErr && guestData) {
            setFormData({
              fullName: guestData.full_name || '',
              email: guestData.email || fallbackEmail,
              role: guestData.role || 'Developer',
              bio: guestData.bio || ''
            });
            if (guestData.avatar_url) {
              setAvatarPreview(guestData.avatar_url);
            }
            return;
          }
        }
        const storageKey = getProfileStorageKey(fallbackEmail || null, null);
        const saved = (() => { try { return JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch { return null; } })();
        if (saved) {
          setFormData({
            fullName: saved.full_name || '',
            email: saved.email || '',
            role: saved.role || 'Developer',
            bio: saved.bio || ''
          });
          if (saved.avatar_url) {
            setAvatarPreview(saved.avatar_url);
          }
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
      }
    };

    loadUserProfile();
  }, [context.user?.uid, context.userEmail, formData.email]);

  const renderProfileSection = () => (
    <div className="profile-section fade-in">
      <div className="profile-header">
        <h2>Profile Information</h2>
      </div>

      <div className="profile-content">
        <div className="profile-avatar">
          <div className="avatar-container">
            <div className="avatar-container-div">
              <div className="avatar-wrapper" onClick={() => setShowAvatarPicker(true)}>
                <div className="avatar-circle">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Profile" className="avatar-image" />
                  ) : (
                    <FaUser className="avatar-icon" />
                  )}
                  <div className="avatar-overlay">
                    <FaUser className="overlay-icon" />
                    <span>Change</span>
                  </div>
                </div>
              </div>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              id="avatar-upload"
              accept="image/jpeg, image/png, image/gif"
              style={{ display: 'none' }}
              onChange={handleAvatarChange}
            />
            <div className="change-avatar-btn-div">
              <button
                className="change-avatar-btn hover-lift"
                onClick={() => setShowAvatarPicker(true)}
              >
                Choose Avatar
              </button>
              <p className="avatar-hint">Choose a preset avatar.</p>
            </div>
            {uploadStatus.message && uploadStatus.success && (
              <div className="upload-status success">
                <FaCheck className="status-icon" />
                <span>{uploadStatus.message}</span>
              </div>
            )}

            <Modal show={showAvatarPicker} onHide={() => setShowAvatarPicker(false)} centered>
              <Modal.Header closeButton>
                <Modal.Title>Choose an Avatar</Modal.Title>
              </Modal.Header>
              <Modal.Body>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(6, 56px)',
                  gap: '12px',
                  justifyContent: 'center'
                }}>
                  {predefinedAvatars.map((url) => (
                    <button
                      key={url}
                      onClick={() => handleSelectPredefinedAvatar(url)}
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: avatarPreview === url ? '2px solid #8b5cf6' : '1px solid rgba(139,92,246,0.35)',
                        padding: 0,
                        background: 'transparent',
                        cursor: 'pointer'
                      }}
                      title="Use this avatar"
                    >
                      <img src={url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </button>
                  ))}
                </div>
              </Modal.Body>
              <Modal.Footer>
                <button className="cancel-btn hover-lift" onClick={() => setShowAvatarPicker(false)}>Close</button>
              </Modal.Footer>
            </Modal>
          </div>
        </div>

        <div className="profile-form">
          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              name="fullName"
              placeholder="Enter your full name"
              value={formData.fullName}
              onChange={handleInputChange}
              className="focus-ring"
            />
          </div>

          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              name="email"
              placeholder="Enter your email"
              value={formData.email}
              readOnly={!!context.user?.uid}
              className="focus-ring"
            />
          </div>

          <div className="form-group">
            <label>Role</label>
            <input
              type="text"
              name="role"
              placeholder="Your role in the organization"
              value={formData.role}
              onChange={handleInputChange}
              className="focus-ring"
            />
          </div>

          <div className="form-group">
            <label>Bio</label>
            <textarea
              name="bio"
              placeholder="Tell us about yourself..."
              value={formData.bio}
              onChange={handleInputChange}
              rows="4"
              className="focus-ring"
            ></textarea>
          </div>

          <div className="form-actions">
            <button
              className="save-btn hover-lift"
              onClick={handleSaveChanges}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <FaSpinner className="spin" /> Saving...
                </>
              ) : 'Save Changes'}
            </button>
            <button
              className="cancel-btn hover-lift"
              onClick={handleCancel}
              disabled={isSaving}
            >
              Cancel
            </button>
            {saveStatus.message && (
              <div className={`save-status ${saveStatus.success ? 'success' : 'error'}`}>
                {saveStatus.success ? (
                  <FaCheck className="status-icon" />
                ) : (
                  <FaTimes className="status-icon" />
                )}
                <span>{saveStatus.message}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderApiManagementSection = () => (
    <div className="api-management-section fade-in">
      <h2>Chatbot API Management</h2>
      <p className="section-description">
        Manage your chatbot API keys, models, and conversation settings
      </p>

      <div className="settings-group">
        <div className="setting-item hover-lift">
          <div className="setting-info">
            <h3>Chatbot API Keys</h3>
            <p>Manage API keys for chatbot services (OpenAI, Claude, etc.)</p>
          </div>
          <button className="manage-btn hover-lift" onClick={handleManageKeys}>
            Manage Keys
          </button>
        </div>
        <div className="setting-item hover-lift">
          <div className="setting-info">
            <h3>API Documentation</h3>
            <p>Access chatbot API documentation and integration guides</p>
          </div>
          <button className="docs-btn hover-lift" onClick={handleViewDocs}>
            View Docs
          </button>
        </div>
        {/* // udit start */}
        <div className="setting-item hover-lift">
          <div className="setting-info">
            <h3>AI Model Selection</h3>
            <p>Choose your preferred AI model for chatbot responses</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', position: 'relative', zIndex: 1002 }}>
            <ul className="nav-list mb-0" ref={aiModelDropdownRef} style={{ listStyle: 'none', padding: 0, position: 'relative' }}>
              <li className={`has-dropdown ${isAiModelOpen ? 'open' : ''}`}>
                <span
                  onClick={() => setIsAiModelOpen(!isAiModelOpen)}
                  className="ai-model-dropdown d-flex align-items-center justify-content-center"
                  style={{
                    cursor: 'pointer',
                    border: '1px solid transparent',
                    borderRadius: '999px',
                    background: 'linear-gradient(135deg, var(--dash-accent, #f0abfc), var(--dash-primary, #a855f7))',
                    opacity: 1,
                    color: '#ffffff',

                  }}
                >
                  {llmModel === "openai/gpt-4o-mini" && "GPT-4o-mini"}
                  {llmModel === "openai/gpt-5.2-codex" && "GPT-5.2-Codex"}
                  {llmModel === "openai/gpt-3.5-turbo" && "GPT-3.5 Turbo"}
                  {llmModel === "anthropic/claude-3.5-sonnet" && "Claude-3.5 Sonnet"}
                </span>

                <ul className="dropdown" >
                  <li>
                    <a
                      href="#model"
                      onClick={(e) => {
                        e.preventDefault();
                        setLlmModel("openai/gpt-4o-mini");
                        setIsAiModelOpen(false);
                      }}
                    >
                      GPT-4o-mini
                    </a>
                  </li>
                  <li>
                    <a
                      href="#model"
                      onClick={(e) => {
                        e.preventDefault();
                        setLlmModel("openai/gpt-5.2-codex");
                        setIsAiModelOpen(false);
                      }}
                    >
                      GPT-5.2-Codex
                    </a>
                  </li>
                  <li>
                    <a
                      href="#model"
                      onClick={(e) => {
                        e.preventDefault();
                        setLlmModel("openai/gpt-3.5-turbo");
                        setIsAiModelOpen(false);
                      }}
                    >
                      GPT-3.5 Turbo
                    </a>
                  </li>
                  <li>
                    <a
                      href="#model"
                      onClick={(e) => {
                        e.preventDefault();
                        setLlmModel("anthropic/claude-3.5-sonnet");
                        setIsAiModelOpen(false);
                      }}
                    >
                      Claude-3.5 Sonnet
                    </a>
                  </li>
                </ul>
              </li>
            </ul>
            <button
              className="save-btn hover-lift"
              onClick={handleSaveLlmSettings}
              disabled={isSavingModel}
              style={{ padding: '0 20px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {isSavingModel ? <FaSpinner className="spin" /> : 'Save'}
            </button>
          </div>
          {llmSaveStatus.message && (
            <div className={`save-status ${llmSaveStatus.success ? 'success' : 'error'}`} style={{ marginTop: '10px' }}>
              {llmSaveStatus.success ? <FaCheck className="status-icon" /> : <FaTimes className="status-icon" />}
              <span>{llmSaveStatus.message}</span>
            </div>
          )}
        </div>
        {/* //udit end */}
      </div>
    </div>
    
  );

  const handleLogout = async () => {
    if (context.setIsSignIn) context.setIsSignIn(false);
    if (context.setUsername) context.setUsername('');
    if (context.setUserEmail) context.setUserEmail('');
    if (context.setUserRole) context.setUserRole('Guest');
    if (context.setUserPermissions) context.setUserPermissions({});
    try { sessionStorage.removeItem('authUser'); } catch (_) { }
    try { localStorage.removeItem('authUser'); } catch (_) { }

    if (context.username && context.userEmail) {
      await databaseService.logEmployeeLogout({ email: context.userEmail });
    }
    navigate('/');
  };

  const renderContent = () => {
    switch (activeSection) {
      case "profile":
        return renderProfileSection();
      case "api-management":
        return renderApiManagementSection();
      default:
        return renderProfileSection();
    }
  };

  return (
    <div className="settings-container">
      <div className="settings-header">
      </div>

      <div className="settings-layout">
        <div className="settings-sidebar">
          <div className="sidebar-menu">
            {settingsSections.map((section) => (
              <button
                key={section.id}
                className={`menu-item ${activeSection === section.id ? "active" : ""}`}
                onClick={() => setSearchParams({ tab: section.id })}
              >
                <span className="menu-icon">{section.icon}</span>
                <div className="menu-content">
                  <span className="menu-title">{section.title}</span>
                  <span className="menu-description">{section.description}</span>
                </div>
              </button>
            ))}

            <button
              className="menu-item logout-button"
              onClick={handleLogout}
              style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.1)' }}
            >
              <span className="menu-icon"><FaSignOutAlt /></span>
              <div className="menu-content">
                <span className="menu-title">Logout</span>
                <span className="menu-description">Sign out of your account</span>
              </div>
            </button>
          </div>
        </div>

        <div className="settings-content" ref={contentRef}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default Setting;