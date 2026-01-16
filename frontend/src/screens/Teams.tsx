import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import BottomNav from '../components/BottomNav';
import { ScreenName } from '../App';
import { teamsApi, Team, TeamMember, SharedContact } from '../services/api';
import { useContactStore } from '../stores/contactStore';

interface TeamsProps {
  onNavigate: (screen: ScreenName) => void;
}

const Teams: React.FC<TeamsProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const { contacts } = useContactStore();

  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Selected team detail view
  const [selectedTeam, setSelectedTeam] = useState<(Team & { members: TeamMember[]; currentUserRole: string }) | null>(null);
  const [teamContacts, setTeamContacts] = useState<SharedContact[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Add member modal
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'admin' | 'member'>('member');
  const [isAddingMember, setIsAddingMember] = useState(false);

  // Share contact modal
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedContactToShare, setSelectedContactToShare] = useState('');
  const [shareVisibility, setShareVisibility] = useState<'basic' | 'full'>('basic');
  const [isSharing, setIsSharing] = useState(false);

  // Fetch teams on mount
  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    setIsLoading(true);
    const result = await teamsApi.list();
    if (result.data) {
      setTeams(result.data);
    }
    setIsLoading(false);
  };

  const createTeam = async () => {
    if (!newTeamName.trim()) return;

    setIsCreating(true);
    const result = await teamsApi.create({ name: newTeamName.trim() });
    if (result.data) {
      setTeams([result.data, ...teams]);
      setShowCreateModal(false);
      setNewTeamName('');
    }
    setIsCreating(false);
  };

  const viewTeamDetail = async (teamId: string) => {
    setIsLoadingDetail(true);
    const [teamResult, contactsResult] = await Promise.all([
      teamsApi.get(teamId),
      teamsApi.getContacts(teamId),
    ]);

    if (teamResult.data) {
      setSelectedTeam(teamResult.data);
    }
    if (contactsResult.data) {
      setTeamContacts(contactsResult.data);
    }
    setIsLoadingDetail(false);
  };

  const addMember = async () => {
    if (!newMemberEmail.trim() || !selectedTeam) return;

    setIsAddingMember(true);
    const result = await teamsApi.addMember(selectedTeam.id, {
      email: newMemberEmail.trim(),
      role: newMemberRole,
    });

    if (result.data) {
      // Refresh team detail
      await viewTeamDetail(selectedTeam.id);
      setShowAddMemberModal(false);
      setNewMemberEmail('');
      setNewMemberRole('member');
    }
    setIsAddingMember(false);
  };

  const removeMember = async (memberId: string) => {
    if (!selectedTeam) return;

    await teamsApi.removeMember(selectedTeam.id, memberId);
    await viewTeamDetail(selectedTeam.id);
  };

  const shareContact = async () => {
    if (!selectedContactToShare || !selectedTeam) return;

    setIsSharing(true);
    await teamsApi.shareContact(selectedTeam.id, {
      contactId: selectedContactToShare,
      visibility: shareVisibility,
    });

    const result = await teamsApi.getContacts(selectedTeam.id);
    if (result.data) {
      setTeamContacts(result.data);
    }
    setShowShareModal(false);
    setSelectedContactToShare('');
    setShareVisibility('basic');
    setIsSharing(false);
  };

  const unshareContact = async (contactId: string) => {
    if (!selectedTeam) return;

    await teamsApi.unshareContact(selectedTeam.id, contactId);
    setTeamContacts(teamContacts.filter(c => c.id !== contactId));
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-yellow-500/20 text-yellow-400';
      case 'admin': return 'bg-blue-500/20 text-blue-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  // Team Detail View
  if (selectedTeam) {
    return (
      <div className="flex flex-col h-full bg-background-dark font-display text-white overflow-hidden">
        {/* Header */}
        <header className="p-6 pb-4 border-b border-white/5">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => setSelectedTeam(null)}
              className="size-10 flex items-center justify-center rounded-full bg-surface-card hover:bg-gray-700 transition-colors"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white">{selectedTeam.name}</h1>
              <p className="text-xs text-text-muted">
                {t('teams.yourRole')}: <span className="capitalize">{selectedTeam.currentUserRole}</span>
              </p>
            </div>
            {['owner', 'admin'].includes(selectedTeam.currentUserRole) && (
              <button
                onClick={() => setShowAddMemberModal(true)}
                className="px-3 py-2 bg-primary text-black rounded-lg text-sm font-bold hover:bg-primary-dark transition-colors"
              >
                {t('teams.addMember')}
              </button>
            )}
          </div>
        </header>

        {isLoadingDetail ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-4 pb-24">
            {/* Members Section */}
            <div className="mb-6">
              <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-3">
                {t('teams.members')} ({selectedTeam.members.length})
              </h3>
              <div className="space-y-2">
                {selectedTeam.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3 bg-surface-card rounded-xl"
                  >
                    <div
                      className="w-10 h-10 rounded-full bg-gray-700 bg-center bg-cover flex-shrink-0"
                      style={{
                        backgroundImage: member.avatar_url
                          ? `url("${member.avatar_url}")`
                          : `url("https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=39E079&color=fff")`,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-white text-sm truncate">{member.name}</h4>
                      <p className="text-xs text-text-muted truncate">{member.email}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${getRoleBadgeColor(member.role)}`}>
                      {member.role}
                    </span>
                    {['owner', 'admin'].includes(selectedTeam.currentUserRole) && member.role !== 'owner' && (
                      <button
                        onClick={() => removeMember(member.id)}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Shared Contacts Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider">
                  {t('teams.sharedContacts')} ({teamContacts.length})
                </h3>
                <button
                  onClick={() => setShowShareModal(true)}
                  className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-lg text-xs font-bold hover:bg-primary/20 transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">share</span>
                  {t('teams.shareContact')}
                </button>
              </div>
              {teamContacts.length === 0 ? (
                <div className="text-center py-8 text-text-muted">
                  <span className="material-symbols-outlined text-4xl mb-2">folder_shared</span>
                  <p className="text-sm">{t('teams.noSharedContacts')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {teamContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center gap-3 p-3 bg-surface-card rounded-xl"
                    >
                      <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center">
                        <span className="text-lg font-bold text-white">
                          {contact.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-white text-sm truncate">{contact.name}</h4>
                        <p className="text-xs text-text-muted truncate">
                          {contact.title || ''} {contact.company ? `@ ${contact.company}` : ''}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {t('teams.sharedBy')} {contact.shared_by_name}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                        contact.visibility === 'full' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {contact.visibility}
                      </span>
                      <button
                        onClick={() => unshareContact(contact.id)}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add Member Modal */}
        {showAddMemberModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-[#2C3435] w-full max-w-sm rounded-2xl p-5 border border-white/10 shadow-2xl">
              <h3 className="text-lg font-bold text-white mb-4">{t('teams.addMember')}</h3>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">
                    {t('teams.memberEmail')}
                  </label>
                  <input
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    className="w-full bg-black/20 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-primary outline-none transition-colors"
                    placeholder="email@example.com"
                    type="email"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">
                    {t('teams.role')}
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNewMemberRole('member')}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${
                        newMemberRole === 'member'
                          ? 'bg-primary text-black border-primary'
                          : 'bg-transparent text-gray-400 border-gray-600 hover:border-gray-500'
                      }`}
                    >
                      {t('teams.roleMember')}
                    </button>
                    <button
                      onClick={() => setNewMemberRole('admin')}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${
                        newMemberRole === 'admin'
                          ? 'bg-primary text-black border-primary'
                          : 'bg-transparent text-gray-400 border-gray-600 hover:border-gray-500'
                      }`}
                    >
                      {t('teams.roleAdmin')}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowAddMemberModal(false)}
                  disabled={isAddingMember}
                  className="flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold transition-colors disabled:opacity-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={addMember}
                  disabled={isAddingMember || !newMemberEmail.trim()}
                  className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary-dark text-black text-sm font-bold transition-colors shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  {isAddingMember ? t('common.loading') : t('common.add')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Share Contact Modal */}
        {showShareModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-[#2C3435] w-full max-w-sm rounded-2xl p-5 border border-white/10 shadow-2xl">
              <h3 className="text-lg font-bold text-white mb-4">{t('teams.shareContact')}</h3>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">
                    {t('teams.selectContact')}
                  </label>
                  <select
                    value={selectedContactToShare}
                    onChange={(e) => setSelectedContactToShare(e.target.value)}
                    className="w-full bg-black/20 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-primary outline-none transition-colors"
                  >
                    <option value="">{t('teams.selectContactPlaceholder')}</option>
                    {contacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name} {contact.company ? `(${contact.company})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">
                    {t('teams.visibility')}
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShareVisibility('basic')}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${
                        shareVisibility === 'basic'
                          ? 'bg-primary text-black border-primary'
                          : 'bg-transparent text-gray-400 border-gray-600 hover:border-gray-500'
                      }`}
                    >
                      {t('teams.visibilityBasic')}
                    </button>
                    <button
                      onClick={() => setShareVisibility('full')}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${
                        shareVisibility === 'full'
                          ? 'bg-primary text-black border-primary'
                          : 'bg-transparent text-gray-400 border-gray-600 hover:border-gray-500'
                      }`}
                    >
                      {t('teams.visibilityFull')}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {shareVisibility === 'basic' ? t('teams.visibilityBasicDesc') : t('teams.visibilityFullDesc')}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowShareModal(false)}
                  disabled={isSharing}
                  className="flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold transition-colors disabled:opacity-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={shareContact}
                  disabled={isSharing || !selectedContactToShare}
                  className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary-dark text-black text-sm font-bold transition-colors shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  {isSharing ? t('common.loading') : t('teams.share')}
                </button>
              </div>
            </div>
          </div>
        )}

        <BottomNav active="home" onNavigate={onNavigate} />
      </div>
    );
  }

  // Teams List View
  return (
    <div className="flex flex-col h-full bg-background-dark font-display text-white overflow-hidden">
      {/* Header */}
      <header className="p-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('dashboard')}
              className="size-10 flex items-center justify-center rounded-full bg-surface-card hover:bg-gray-700 transition-colors"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <h1 className="text-xl font-bold text-white">{t('teams.title')}</h1>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1 px-3 py-2 bg-primary text-black rounded-lg text-sm font-bold hover:bg-primary-dark transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t('teams.create')}
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-24">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : teams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <span className="material-symbols-outlined text-4xl text-text-muted mb-3">groups</span>
            <p className="text-text-muted text-center">{t('teams.noTeams')}</p>
            <p className="text-text-muted/60 text-sm text-center mt-1">{t('teams.createFirst')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {teams.map((team) => (
              <div
                key={team.id}
                onClick={() => viewTeamDetail(team.id)}
                className="bg-surface-card rounded-2xl p-4 cursor-pointer hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary">groups</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-white">{team.name}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-text-muted flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">person</span>
                          {team.member_count || 1} {t('teams.members')}
                        </span>
                        <span className="text-xs text-text-muted flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">contacts</span>
                          {team.contact_count || 0} {t('teams.contacts')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${getRoleBadgeColor(team.role || 'member')}`}>
                    {team.role || 'member'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Team Modal */}
      {showCreateModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#2C3435] w-full max-w-sm rounded-2xl p-5 border border-white/10 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">{t('teams.createTeam')}</h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">
                  {t('teams.teamName')}
                </label>
                <input
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="w-full bg-black/20 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-primary outline-none transition-colors"
                  placeholder={t('teams.teamNamePlaceholder')}
                  autoFocus
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={isCreating}
                className="flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold transition-colors disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={createTeam}
                disabled={isCreating || !newTeamName.trim()}
                className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary-dark text-black text-sm font-bold transition-colors shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {isCreating ? t('common.loading') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav active="home" onNavigate={onNavigate} />
    </div>
  );
};

export default Teams;
