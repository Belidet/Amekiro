// Offline Sync Utility for Family Reminder Tracker
// Handles storing completions when offline and syncing when back online

class OfflineSync {
  constructor() {
    this.pendingCompletions = [];
    this.isOnline = navigator.onLine;
    this.setupListeners();
    this.loadPending();
  }
  
  setupListeners() {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncAll();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('Offline mode - saving completions locally');
    });
    
    // Listen for service worker sync events
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready.then(registration => {
        registration.sync.register('sync-completions');
      });
    }
  }
  
  loadPending() {
    const stored = localStorage.getItem('pendingCompletions');
    if (stored) {
      this.pendingCompletions = JSON.parse(stored);
    }
  }
  
  savePending() {
    localStorage.setItem('pendingCompletions', JSON.stringify(this.pendingCompletions));
  }
  
  addCompletion(completion) {
    this.pendingCompletions.push({
      ...completion,
      pendingId: Date.now() + '-' + Math.random(),
      timestamp: new Date().toISOString()
    });
    this.savePending();
    
    // Try to sync immediately if online
    if (this.isOnline) {
      this.syncAll();
    }
    
    return this.pendingCompletions.length;
  }
  
  async syncAll() {
    if (!this.isOnline) return;
    if (this.pendingCompletions.length === 0) return;
    
    const token = localStorage.getItem('token');
    if (!token) return;
    
    const toSync = [...this.pendingCompletions];
    const successful = [];
    const failed = [];
    
    for (const completion of toSync) {
      try {
        const response = await fetch('/api/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            taskId: completion.taskId,
            taskType: completion.taskType,
            date: completion.date,
            completed: completion.completed
          })
        });
        
        if (response.ok) {
          successful.push(completion.pendingId);
        } else {
          failed.push(completion);
        }
      } catch (error) {
        console.error('Sync failed for completion:', completion, error);
        failed.push(completion);
      }
    }
    
    // Remove successful ones
    this.pendingCompletions = this.pendingCompletions.filter(
      c => !successful.includes(c.pendingId)
    );
    this.savePending();
    
    // Dispatch event to notify app
    window.dispatchEvent(new CustomEvent('sync-complete', {
      detail: { synced: successful.length, remaining: this.pendingCompletions.length }
    }));
    
    return { synced: successful.length, remaining: this.pendingCompletions.length };
  }
  
  getPendingCount() {
    return this.pendingCompletions.length;
  }
  
  getPending() {
    return [...this.pendingCompletions];
  }
  
  clearAll() {
    this.pendingCompletions = [];
    this.savePending();
  }
}

// Initialize global sync manager
const offlineSync = new OfflineSync();

// Helper function to track completion with offline support
window.trackCompletionWithOffline = async function(taskId, taskType, date, completed) {
  if (navigator.onLine) {
    // Online - use normal API
    try {
      const response = await fetch('/api/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ taskId, taskType, date, completed })
      });
      
      if (response.ok) {
        return { success: true, offline: false };
      } else {
        // If API fails, store offline
        offlineSync.addCompletion({ taskId, taskType, date, completed });
        return { success: true, offline: true, pending: offlineSync.getPendingCount() };
      }
    } catch (error) {
      offlineSync.addCompletion({ taskId, taskType, date, completed });
      return { success: true, offline: true, pending: offlineSync.getPendingCount() };
    }
  } else {
    // Offline - store locally
    offlineSync.addCompletion({ taskId, taskType, date, completed });
    return { success: true, offline: true, pending: offlineSync.getPendingCount() };
  }
};

// Export for use in main script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OfflineSync, offlineSync };
}
