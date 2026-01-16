import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNotificationStore } from '../stores/notificationStore';
import { useContactStore } from '../stores/contactStore';

const CreateNotificationModal: React.FC = () => {
  const { t } = useTranslation();
  const { isCreateModalOpen, preselectedContactId, closeCreateModal, createNotification, isLoading } = useNotificationStore();
  const { contacts, fetchContacts } = useContactStore();

  const [contactId, setContactId] = useState<string>('');
  const [note, setNote] = useState('');
  const [remindDate, setRemindDate] = useState('');
  const [remindTime, setRemindTime] = useState('09:00');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isCreateModalOpen) {
      fetchContacts();
      // Set default date to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setRemindDate(tomorrow.toISOString().split('T')[0]);

      // Pre-select contact if provided
      if (preselectedContactId) {
        setContactId(preselectedContactId);
      }
    }
  }, [isCreateModalOpen, preselectedContactId, fetchContacts]);

  useEffect(() => {
    // Reset form when modal closes
    if (!isCreateModalOpen) {
      setContactId('');
      setNote('');
      setSearchQuery('');
    }
  }, [isCreateModalOpen]);

  if (!isCreateModalOpen) return null;

  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.company && c.company.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const selectedContact = contacts.find((c) => c.id === contactId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remindDate) return;

    const remindAt = new Date(`${remindDate}T${remindTime}`).toISOString();
    await createNotification({
      contactId: contactId || undefined,
      note: note || undefined,
      remindAt,
    });
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/70 z-[60]"
        onClick={closeCreateModal}
      />

      {/* Modal */}
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-md mx-auto bg-surface-card rounded-xl z-[60] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">{t('notifications.createReminder')}</h2>
          <button
            onClick={closeCreateModal}
            className="p-2 rounded-full hover:bg-gray-800 transition-colors"
          >
            <span className="material-symbols-outlined text-gray-400">close</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Contact selector */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">{t('notifications.contact')}</label>
            {selectedContact ? (
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                <div>
                  <p className="text-white font-medium">{selectedContact.name}</p>
                  {selectedContact.company && (
                    <p className="text-sm text-gray-400">{selectedContact.company}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setContactId('')}
                  className="p-1 text-gray-500 hover:text-white"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('notifications.searchContact')}
                  className="w-full p-3 bg-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {searchQuery && filteredContacts.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-lg max-h-48 overflow-y-auto z-10">
                    {filteredContacts.slice(0, 5).map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => {
                          setContactId(contact.id);
                          setSearchQuery('');
                        }}
                        className="w-full p-3 text-left hover:bg-gray-700 transition-colors"
                      >
                        <p className="text-white">{contact.name}</p>
                        {contact.company && (
                          <p className="text-sm text-gray-400">{contact.company}</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">{t('notifications.contactOptional')}</p>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('notifications.date')}</label>
              <input
                type="date"
                value={remindDate}
                onChange={(e) => setRemindDate(e.target.value)}
                required
                className="w-full p-3 bg-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('notifications.time')}</label>
              <input
                type="time"
                value={remindTime}
                onChange={(e) => setRemindTime(e.target.value)}
                required
                className="w-full p-3 bg-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">{t('notifications.note')}</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('notifications.notePlaceholder')}
              rows={3}
              className="w-full p-3 bg-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading || !remindDate}
            className="w-full py-3 bg-primary text-black font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
            ) : (
              <>
                <span className="material-symbols-outlined text-[20px]">alarm_add</span>
                {t('notifications.create')}
              </>
            )}
          </button>
        </form>
      </div>
    </>
  );
};

export default CreateNotificationModal;
