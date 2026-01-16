import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScreenName } from '../App';
import { useContactStore } from '../stores/contactStore';
import { Contact } from '../services/api';

interface CompanyDetailProps {
  onNavigate: (screen: ScreenName) => void;
}

interface DepartmentGroup {
  department: string;
  contacts: Contact[];
}

const CompanyDetail: React.FC<CompanyDetailProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const { contacts, selectedContact, setSelectedContact, fetchContacts, isLoading } = useContactStore();
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());

  // Get company name from selected contact
  const companyName = selectedContact?.company || '';

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Filter contacts by company and group by department
  const departmentGroups = useMemo((): DepartmentGroup[] => {
    const companyContacts = contacts.filter(c => c.company === companyName);

    const groups: Record<string, Contact[]> = {};

    companyContacts.forEach(contact => {
      const dept = contact.department || t('company.noDepartment');
      if (!groups[dept]) {
        groups[dept] = [];
      }
      groups[dept].push(contact);
    });

    // Sort departments alphabetically, but put "No Department" last
    return Object.entries(groups)
      .map(([department, contacts]) => ({ department, contacts }))
      .sort((a, b) => {
        const noDept = t('company.noDepartment');
        if (a.department === noDept) return 1;
        if (b.department === noDept) return -1;
        return a.department.localeCompare(b.department);
      });
  }, [contacts, companyName, t]);

  const totalContacts = departmentGroups.reduce((sum, g) => sum + g.contacts.length, 0);

  const toggleDepartment = (dept: string) => {
    setExpandedDepartments(prev => {
      const next = new Set(prev);
      if (next.has(dept)) {
        next.delete(dept);
      } else {
        next.add(dept);
      }
      return next;
    });
  };

  const handleContactClick = (contact: Contact) => {
    setSelectedContact(contact);
    onNavigate('profile');
  };

  // Expand all departments by default
  useEffect(() => {
    const allDepts = new Set(departmentGroups.map(g => g.department));
    setExpandedDepartments(allDepts);
  }, [departmentGroups]);

  if (!companyName) {
    return (
      <div className="flex flex-col h-full bg-background-dark font-display text-white items-center justify-center">
        <span className="material-symbols-outlined text-[48px] text-gray-600 mb-4">business</span>
        <p className="text-gray-400">{t('common.noData')}</p>
        <button
          onClick={() => onNavigate('dashboard')}
          className="mt-4 px-4 py-2 bg-primary text-black rounded-lg font-bold text-sm"
        >
          {t('profile.goToDashboard')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background-dark font-display text-white overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background-dark/95 backdrop-blur-sm border-b border-white/5">
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={() => onNavigate('profile')}
            className="flex size-10 items-center justify-center rounded-full bg-surface-card shadow-sm hover:bg-gray-700 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back_ios_new</span>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white truncate">{companyName}</h1>
            <p className="text-xs text-gray-400">
              {t('company.contactsCount', { count: totalContacts })}
            </p>
          </div>
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
            <span className="material-symbols-outlined text-primary text-[24px]">corporate_fare</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : departmentGroups.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <span className="material-symbols-outlined text-3xl mb-2 block">group_off</span>
            <p className="text-sm">{t('common.noData')}</p>
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            {departmentGroups.map((group) => (
              <div key={group.department} className="bg-surface-card rounded-2xl border border-white/5 overflow-hidden">
                {/* Department Header */}
                <button
                  onClick={() => toggleDepartment(group.department)}
                  className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                      <span className="material-symbols-outlined text-primary text-[18px]">folder</span>
                    </div>
                    <div className="text-left">
                      <h3 className="font-bold text-white text-sm">{group.department}</h3>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                        {group.contacts.length} {group.contacts.length === 1 ? t('networkMap.connection') : t('networkMap.connections')}
                      </p>
                    </div>
                  </div>
                  <span className={`material-symbols-outlined text-gray-400 transition-transform duration-200 ${expandedDepartments.has(group.department) ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </button>

                {/* Contacts List */}
                {expandedDepartments.has(group.department) && (
                  <div className="border-t border-white/5">
                    {group.contacts.map((contact, idx) => (
                      <button
                        key={contact.id}
                        onClick={() => handleContactClick(contact)}
                        className={`w-full flex items-center gap-3 p-4 hover:bg-white/5 transition-colors ${idx !== group.contacts.length - 1 ? 'border-b border-white/5' : ''}`}
                      >
                        <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-accent/30 shrink-0">
                          <span className="text-sm font-bold text-white">
                            {contact.name?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="font-medium text-white text-sm truncate">{contact.name}</p>
                          {contact.title && (
                            <p className="text-xs text-gray-400 truncate">{contact.title}</p>
                          )}
                        </div>
                        <span className="material-symbols-outlined text-gray-600 text-[18px]">chevron_right</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyDetail;
