import { useState, useEffect, useCallback } from 'react';
import { X, Save, Loader2, LogOut, Briefcase, GraduationCap, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import api from '../lib/axios';

interface ProfilePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface StudentProfile {
  firstName: string;
  lastName: string;
  college: string;
  cgpa: number;
  experienceYears: number;
  parsedSkills: string[];
}

interface RecruiterProfile {
  companyName: string;
  designation: string;
}

export default function ProfilePanel({ isOpen, onClose }: ProfilePanelProps) {
  const { user, logout } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Student State
  const [studentForm, setStudentForm] = useState<StudentProfile>({
    firstName: '',
    lastName: '',
    college: '',
    cgpa: 0,
    experienceYears: 0,
    parsedSkills: [],
  });

  // Recruiter State
  const [recruiterForm, setRecruiterForm] = useState<RecruiterProfile>({
    companyName: '',
    designation: '',
  });

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      if (user.role === 'STUDENT') {
        const { data } = await api.get<{ data: StudentProfile }>('/student/profile');
        setStudentForm(data.data);
      } else if (user.role === 'RECRUITER') {
        const { data } = await api.get<{ data: RecruiterProfile }>('/student/recruiter-profile');
        setRecruiterForm(data.data);
      }
    } catch {
      toast.error('Failed to load profile details.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen) {
      void fetchProfile();
      // Prevent body scroll when panel is open
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, fetchProfile]);

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      if (user.role === 'STUDENT') {
        await api.put('/student/profile', studentForm);
        toast.success('Profile updated successfully!');
      } else if (user.role === 'RECRUITER') {
        await api.put('/student/recruiter-profile', recruiterForm);
        toast.success('Profile updated successfully!');
      }
      onClose();
    } catch {
      toast.error('Failed to save profile details.');
    } finally {
      setSaving(false);
    }
  };

  const getInitials = () => {
    if (user?.role === 'STUDENT') {
      const f = studentForm.firstName || '';
      const l = studentForm.lastName || '';
      if (f || l) return `${f.charAt(0)}${l.charAt(0)}`.toUpperCase();
    } else if (user?.role === 'RECRUITER') {
      const c = recruiterForm.companyName || '';
      if (c) return c.substring(0, 2).toUpperCase();
    }
    return user?.email?.substring(0, 2).toUpperCase() || 'U';
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[100] transition-opacity"
        onClick={onClose}
      />

      {/* Slide-in Panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-[110] transform transition-transform duration-300 ease-in-out flex flex-col border-l border-slate-200">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-lg tracking-wide">{getInitials()}</span>
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">Profile Settings</h2>
              <p className="text-sm text-slate-500 font-medium">{user?.email}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-3">
              <Loader2 className="animate-spin" size={24} />
              <p className="text-sm font-medium">Loading profile...</p>
            </div>
          ) : (
            <div className="space-y-5">
              
              {/* Role Badge Section */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Account Type</p>
                  <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    {user?.role === 'STUDENT' && <GraduationCap size={16} className="text-indigo-500" />}
                    {user?.role === 'RECRUITER' && <Briefcase size={16} className="text-emerald-500" />}
                    {user?.role === 'ADMIN' && <Shield size={16} className="text-rose-500" />}
                    {user?.role}
                  </p>
                </div>
              </div>

              {user?.role === 'STUDENT' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-700">First Name</label>
                      <input
                        type="text"
                        value={studentForm.firstName}
                        onChange={(e) => setStudentForm({ ...studentForm, firstName: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-700">Last Name</label>
                      <input
                        type="text"
                        value={studentForm.lastName}
                        onChange={(e) => setStudentForm({ ...studentForm, lastName: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">College / University</label>
                    <input
                      type="text"
                      value={studentForm.college}
                      onChange={(e) => setStudentForm({ ...studentForm, college: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-700">CGPA</label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.1"
                        value={studentForm.cgpa}
                        onChange={(e) => setStudentForm({ ...studentForm, cgpa: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-700">Experience (Years)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={studentForm.experienceYears}
                        onChange={(e) => setStudentForm({ ...studentForm, experienceYears: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                      />
                    </div>
                  </div>

                  {studentForm.parsedSkills.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <label className="text-sm font-semibold text-slate-700">Skills (from Resume)</label>
                      <div className="flex flex-wrap gap-2">
                        {studentForm.parsedSkills.map((s) => (
                          <span key={s} className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-md border border-indigo-100">
                            {s}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">Re-upload your resume to update skills.</p>
                    </div>
                  )}
                </>
              )}

              {user?.role === 'RECRUITER' && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Company Name</label>
                    <input
                      type="text"
                      value={recruiterForm.companyName}
                      onChange={(e) => setRecruiterForm({ ...recruiterForm, companyName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Designation</label>
                    <input
                      type="text"
                      value={recruiterForm.designation}
                      onChange={(e) => setRecruiterForm({ ...recruiterForm, designation: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow"
                    />
                  </div>
                </>
              )}

              {user?.role === 'ADMIN' && (
                <div className="p-4 bg-rose-50 text-rose-700 rounded-xl border border-rose-100 flex items-center justify-center">
                  <p className="text-sm font-medium text-center">Admin accounts are system-managed.<br/>No editable profile fields.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-100 bg-white space-y-3">
          {user?.role !== 'ADMIN' && (
            <button
              onClick={() => void handleSave()}
              disabled={saving || loading}
              className="w-full btn-primary flex justify-center py-2.5"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {saving ? 'Saving Changes...' : 'Save Changes'}
            </button>
          )}
          
          <button
            onClick={() => {
              onClose();
              logout();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors border border-red-100"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}
