<script>
        // --- Supabase Client Setup ---
        const SUPABASE_URL = 'https://pfbxtbydrjcmqlrklsdr.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmYnh0YnlkcmpjbXFscmtsc2RyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5ODM2NDksImV4cCI6MjA3MjU1OTY0OX0.bOgnown0UZzstbnYfUSEImwaSGP6lg2FccRg-yDFTPU';
        const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        document.addEventListener('DOMContentLoaded', () => {
            // --- Global State & Cache Keys ---
            let currentProject = null;
            let currentIssue = null;
            let currentTemplateId = null;
            let currentRandomClosing = '';
            let pendingImportData = null;

            const CACHE_KEYS = {
                PROJECTS: 'tm-cache-projects', TEMPLATES: 'tm-cache-templates',
                SIGNATURES: 'tm-cache-signatures', PLACEHOLDERS: 'tm-cache-placeholders',
                SETTINGS: 'tm-cache-settings', SUPPLIERS: 'tm-cache-suppliers',
                CHILDREN: 'tm-cache-children', SELECTED_SIGNER_ID: 'tm-selected-signer-id'
            };
            
            // --- DOM Elements ---
            const dom = {
                appContainer: document.getElementById('app-container'),
                syncStatus: document.getElementById('sync-status'), syncText: document.getElementById('sync-text'),
                syncIconSyncing: document.getElementById('sync-icon-syncing'), syncIconSuccess: document.getElementById('sync-icon-success'),
                syncIconError: document.getElementById('sync-icon-error'), themeSwitcher: document.getElementById('theme-switcher'),
                currentSignerDisplay: document.getElementById('current-signer-display'), changeSignerBtn: document.getElementById('change-signer-btn'),
                projectTabsContainer: document.getElementById('project-tabs-container'), issuesListContainer: document.getElementById('issues-list'),
                templateListContainer: document.getElementById('template-list'), searchInput: document.getElementById('search-input'),
                newTemplateBtn: document.getElementById('new-template-btn'), workspace: document.getElementById('workspace'),
                welcomeScreen: document.getElementById('welcome-screen'), templateForm: document.getElementById('template-form'),
                templateViewer: document.getElementById('template-viewer'), editorForm: document.getElementById('editor-form'),
                formTitle: document.getElementById('form-title'), templateIdInput: document.getElementById('template-id'),
                mainIssueInput: document.getElementById('main-issue'), existingIssuesDatalist: document.getElementById('existing-issues'),
                templateNameInput: document.getElementById('template-name'), templateDescriptionInput: document.getElementById('template-description'),
                templateContentTextarea: document.getElementById('template-content-textarea'), componentSource: document.getElementById('component-source'),
                sendToCustomerCheckbox: document.getElementById('send-to-customer'),
                includeFooterCheckbox: document.getElementById('include-footer'), addLabelReminderCheckbox: document.getElementById('add-label-reminder'),
                labelNameInput: document.getElementById('label-name'), addOptionalFieldCheckbox: document.getElementById('add-optional-field'),
                optionalFieldNameInput: document.getElementById('optional-field-name'), addFollowUpCheckbox: document.getElementById('add-follow-up'),
                customerTemplateFields: document.getElementById('customer-template-fields'), customerSubjectInput: document.getElementById('customer-subject'),
                customerBodyInput: document.getElementById('customer-body'), internalCommentFields: document.getElementById('internal-comment-fields'),
                addInternalCommentCheckbox: document.getElementById('add-internal-comment'), internalCommentInputContainer: document.getElementById('internal-comment-input-container'),
                internalCommentBodyInput: document.getElementById('internal-comment-body'), cancelBtn: document.getElementById('cancel-btn'),
                viewerTitle: document.getElementById('viewer-title'), viewerCategory: document.getElementById('viewer-category'),
                viewerUpdatedDate: document.getElementById('viewer-updated-date'), viewerDescription: document.getElementById('viewer-description'),
                viewerAgentNameInput: document.getElementById('viewer-agent-name'), viewerSuIdInput: document.getElementById('viewer-su-id'),
                viewerManualSupplierContainer: document.getElementById('viewer-manual-supplier-container'), viewerManualSupplierNameInput: document.getElementById('viewer-manual-supplier-name'),
                placeholdersContainer: document.getElementById('placeholders-container'), optionalsContainer: document.getElementById('optionals-container'),
                dynamicOptionalFieldContainer: document.getElementById('dynamic-optional-field-container'), finalOutput: document.getElementById('final-output'),
                copyBtn: document.getElementById('copy-btn'), copyFeedback: document.getElementById('copy-feedback'),
                notificationToast: document.getElementById('notification-toast'), openDataManagerBtn: document.getElementById('open-data-manager-btn'),
                dataManagerModal: document.getElementById('data-manager-modal'), closeDataManagerBtn: document.getElementById('close-data-manager-btn'),
                dataManagerTabs: document.getElementById('data-manager-tabs'), showMovementGuideBtn: document.getElementById('show-movement-guide-btn'),
                movementGuideEditor: document.getElementById('movement-guide-editor'), movementGuideStepsContainer: document.getElementById('movement-guide-steps-container'),
                addMovementStepBtn: document.getElementById('add-movement-step-btn'), followUpGuideEditor: document.getElementById('follow-up-guide-editor'),
                followUpGuideStepsContainer: document.getElementById('follow-up-guide-steps-container'), addFollowUpStepBtn: document.getElementById('add-follow-up-step-btn'),
                showFollowUpGuideBtn: document.getElementById('show-follow-up-guide-btn'), openHelpBtn: document.getElementById('open-help-btn'),
                helpModal: document.getElementById('help-modal'), closeHelpModalBtn: document.getElementById('close-help-modal-btn'),
                helpContent: document.getElementById('help-content'), importOptionsModal: document.getElementById('import-options-modal'),
                signatureSelectionModal: document.getElementById('signature-selection-modal'), signatureSelectDropdown: document.getElementById('signature-select-dropdown'),
                signatureConfirmBtn: document.getElementById('signature-confirm-btn')
            };

            // --- Caching & Sync Logic ---
            const getFromCache = (key) => JSON.parse(localStorage.getItem(key) || '[]');
            const saveToCache = (key, data) => localStorage.setItem(key, JSON.stringify(data));

            function setSyncStatus(status, message) {
                dom.syncIconSyncing.classList.toggle('hidden', status !== 'syncing');
                dom.syncIconSuccess.classList.toggle('hidden', status !== 'success');
                dom.syncIconError.classList.toggle('hidden', status !== 'error');
                dom.syncText.textContent = message;
            }

            async function syncWithSupabase() {
                setSyncStatus('syncing', 'Syncing...');
                try {
                    const tables = ['projects', 'templates', 'signatures', 'placeholders', 'settings', 'suppliers', 'children'];
                    const queries = tables.map(table => table === 'templates' ? supabase.from(table).select('*, projects(name)') : supabase.from(table).select('*'));
                    const results = await Promise.all(queries);

                    for (let i = 0; i < results.length; i++) {
                        if (results[i].error) throw results[i].error;
                        saveToCache(`tm-cache-${tables[i]}`, results[i].data || []);
                    }
                    
                    await initializeAppUI();
                    if (!localStorage.getItem(CACHE_KEYS.SELECTED_SIGNER_ID)) {
                        openSignatureSelectionModal();
                    }
                    setSyncStatus('success', 'Up to date');
                } catch (error) {
                    setSyncStatus('error', 'Sync Failed');
                    showNotification('Could not sync with the database. Using local data.', 'error');
                    console.error("Sync error:", error);
                }
            }
            
            // --- UI Rendering ---
            function showView(view) {
                dom.welcomeScreen.classList.toggle('hidden', view !== 'welcome');
                dom.templateForm.classList.toggle('hidden', view !== 'form');
                dom.templateViewer.classList.toggle('hidden', view !== 'viewer');
            }
            
            function renderCurrentSigner() {
                const signatures = getFromCache(CACHE_KEYS.SIGNATURES);
                const selectedId = localStorage.getItem(CACHE_KEYS.SELECTED_SIGNER_ID);
                let signer = null;
                if (selectedId) signer = (signatures || []).find(s => s.id == selectedId);
                if (!signer) signer = (signatures || []).find(s => s.isDefault) || signatures[0];
                if (signer && !selectedId) localStorage.setItem(CACHE_KEYS.SELECTED_SIGNER_ID, signer.id);
                dom.currentSignerDisplay.textContent = signer ? signer.name : 'No signer set';
            }

            function renderProjectTabs() {
                const projects = getFromCache(CACHE_KEYS.PROJECTS);
                if (!projects.length) {
                    dom.projectTabsContainer.innerHTML = `<p class="text-sm text-red-500">No projects found. Please add one in settings.</p>`;
                    return;
                }
                if (!currentProject || !projects.some(p => p.id === currentProject)) {
                    currentProject = projects[0].id;
                }
                dom.projectTabsContainer.innerHTML = projects.map(project => {
                    const isActive = project.id === currentProject;
                    const color = project.color || '#6B7280';
                    const style = isActive 
                        ? `background-color: ${color}; color: white;` 
                        : `background-color: rgba(${hexToRgb(color)}, 0.1); color: ${color};`;
                    return `<button data-project-id="${project.id}" class="project-tab font-bold py-2 px-4 rounded-lg transition-colors ${isActive ? 'active' : ''}" style="${style}">${project.name}</button>`;
                }).join('');
            }

            function renderIssuesList() {
                if (!currentProject) { dom.issuesListContainer.innerHTML = ''; return; }
                const projectTemplates = getFromCache(CACHE_KEYS.TEMPLATES).filter(t => t.project === currentProject);
                const issues = [...new Set(projectTemplates.map(t => t.issue))].sort((a,b) => a.localeCompare(b));
                dom.issuesListContainer.innerHTML = issues.length === 0 ? `<p class="text-[rgb(var(--color-text-muted))] text-center text-sm">No categories in this project.</p>` :
                    issues.map(issue => `<button class="w-full text-left p-2 rounded-md transition-colors ${issue === currentIssue ? 'bg-[rgb(var(--color-accent-primary))] text-white font-semibold' : 'hover:bg-[rgb(var(--color-bg-secondary))]'}">${issue}</button>`).join('');
            }

            function renderTemplateList(filter = '') {
                const allTemplates = getFromCache(CACHE_KEYS.TEMPLATES);
                let filteredTemplates;

                if (filter) {
                    filteredTemplates = allTemplates
                        .filter(t => t.project === currentProject && t.name.toLowerCase().includes(filter.toLowerCase()))
                        .sort((a, b) => a.name.localeCompare(b.name));
                } 
                else if (currentIssue) {
                    filteredTemplates = allTemplates
                        .filter(t => t.project === currentProject && t.issue === currentIssue)
                        .sort((a, b) => a.name.localeCompare(b.name));
                } 
                else {
                    dom.templateListContainer.innerHTML = `<p class="text-[rgb(var(--color-text-muted))] text-center mt-4">Select a category or start typing to search all templates.</p>`;
                    return;
                }

                dom.templateListContainer.innerHTML = '';

                if (filteredTemplates.length === 0) {
                    dom.templateListContainer.innerHTML = `<p class="text-[rgb(var(--color-text-muted))] text-center mt-4">No matching templates found.</p>`;
                    return;
                }

                filteredTemplates.forEach(template => {
                    const item = document.createElement('div');
                    item.className = "template-item p-2 rounded-md hover:bg-[rgba(var(--color-accent-primary),0.1)] cursor-pointer";
                    item.dataset.templateId = template.id;

                    const lastUpdated = template.updated_at || template.created_at;
                    const timeAgoStr = lastUpdated ? timeAgo(lastUpdated) : '';
                    const customerTag = template.sendToCustomer ? '<span class="font-semibold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded-full ml-2">Customer</span>' : '';
                    
                    item.innerHTML = `
                        <div class="flex justify-between items-start">
                            <div class="flex-grow mr-2">
                                <span class="font-medium">${template.name}</span>
                                <p class="text-xs text-[rgb(var(--color-text-muted))] mt-1">${timeAgoStr}${customerTag}</p>
                            </div>
                            <div class="flex gap-2 flex-shrink-0">
                                <button class="edit-btn p-1" title="Sửa"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent-primary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.536L16.732 3.732z" /></svg></button>
                                <button class="delete-btn p-1" title="Xóa"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[rgb(var(--color-text-muted))] hover:text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                            </div>
                        </div>
                    `;
                    
                    item.addEventListener('click', () => {
                        showTemplateViewer(template.id);
                    });

                    item.querySelector('.edit-btn').addEventListener('click', (e) => {
                        e.stopPropagation();
                        showTemplateForm(template.id);
                    });

                    item.querySelector('.delete-btn').addEventListener('click', (e) => {
                        e.stopPropagation();
                        deleteTemplate(template.id);
                    });

                    dom.templateListContainer.appendChild(item);
                });
            }
            
            async function deleteTemplate(id) {
                if (!confirm('Are you sure you want to delete this template?')) return;
                const { error } = await supabase.from('templates').delete().eq('id', id);
                if (error) return showNotification('Error deleting template', 'error');
                showNotification('Template deleted.', 'info');
                if (currentTemplateId === id) showView('welcome');
                await syncWithSupabase();
            }

            function populateIssuesDatalist() {
                const issues = [...new Set(getFromCache(CACHE_KEYS.TEMPLATES).filter(t => t.project === currentProject).map(t => t.issue))].sort();
                dom.existingIssuesDatalist.innerHTML = issues.map(issue => `<option value="${issue}"></option>`).join('');
            }
            
            function showTemplateForm(id = null) {
                dom.editorForm.reset();
                dom.movementGuideStepsContainer.innerHTML = '';
                dom.followUpGuideStepsContainer.innerHTML = '';
                dom.includeFooterCheckbox.checked = true;
                populateIssuesDatalist();

                let templateContent = '';
                if (id) {
                    const template = getFromCache(CACHE_KEYS.TEMPLATES).find(t => t.id === id);
                    if (!template) return showNotification('Template not found', 'error');
                    templateContent = template.content;
                    dom.formTitle.textContent = 'Edit Template';
                    dom.templateIdInput.value = template.id;
                    dom.mainIssueInput.value = template.issue;
                    dom.templateNameInput.value = template.name;
                    dom.templateDescriptionInput.value = template.description || '';
                    dom.sendToCustomerCheckbox.checked = template.sendToCustomer;
                    dom.includeFooterCheckbox.checked = template.includeFooter;
                    dom.addLabelReminderCheckbox.checked = template.addLabelReminder;
                    dom.addInternalCommentCheckbox.checked = template.addInternalComment;
                    dom.addOptionalFieldCheckbox.checked = template.hasOptionalField;
                    dom.addFollowUpCheckbox.checked = !!template.followUpGuide;
                    dom.internalCommentBodyInput.value = template.internalComment || '';
                    dom.labelNameInput.value = template.labelName || '';
                    dom.optionalFieldNameInput.value = template.optionalFieldNames || '';
                    dom.customerSubjectInput.value = template.customerSubject || '';
                    dom.customerBodyInput.value = template.customerBody || '';
                    if (template.movementGuide) template.movementGuide.forEach(step => dom.movementGuideStepsContainer.appendChild(createGuideStepEditor('movement', step)));
                    if (template.followUpGuide) template.followUpGuide.forEach(step => dom.followUpGuideStepsContainer.appendChild(createGuideStepEditor('follow-up', step)));
                } else {
                    const currentProjectName = getFromCache(CACHE_KEYS.PROJECTS).find(p => p.id === currentProject)?.name || '';
                    dom.formTitle.textContent = `Create New Template for ${currentProjectName}`;
                    dom.templateIdInput.value = '';
                    if (currentIssue) dom.mainIssueInput.value = currentIssue;
                }
                setupInteractiveEditor(templateContent);
                updateFormVisibility();
                showView('form');
            }

            function createPlaceholderInput(pKey, allPlaceholdersMap) {
                const placeholderData = allPlaceholdersMap.get(pKey.toLowerCase());
                const wrapper = document.createElement('div');
                wrapper.className = 'flex flex-col mb-4 placeholder-input-wrapper';
                const uniqueId = `ph-${pKey}-${Math.random().toString(36).substr(2, 9)}`;
                let fieldHtml;
                const type = placeholderData ? placeholderData.type : 'entry';
                switch (type) {
                    case 'droplist':
                        fieldHtml = `<select class="w-full p-2 border border-[rgb(var(--color-border))] rounded-md bg-[rgb(var(--color-bg-primary))] mt-1" id="${uniqueId}" data-placeholder="${pKey}">${(placeholderData.options || []).map(opt => `<option value="${opt.value}">${opt.text || opt.value}</option>`).join('')}</select>`;
                        break;
                    case 'date':
                        fieldHtml = `<input type="date" class="w-full p-2 border border-[rgb(var(--color-border))] rounded-md bg-[rgb(var(--color-bg-primary))] mt-1" id="${uniqueId}" data-placeholder="${pKey}">`;
                        break;
                    default:
                        fieldHtml = `<input type="text" class="w-full p-2 border border-[rgb(var(--color-border))] rounded-md bg-[rgb(var(--color-bg-primary))] mt-1" id="${uniqueId}" data-placeholder="${pKey}">`;
                }
                wrapper.innerHTML = `
                    <label for="${uniqueId}" class="font-medium text-[rgb(var(--color-text-secondary))]">${pKey.replace(/_/g, ' ')}</label>
                    ${placeholderData?.description ? `<p class="text-xs text-[rgb(var(--color-text-muted))] mt-1 whitespace-pre-wrap">${placeholderData.description}</p>` : ''}
                    ${fieldHtml}`;
                const field = wrapper.querySelector('[data-placeholder]');
                field.addEventListener(field.tagName === 'SELECT' || field.type === 'date' ? 'change' : 'input', updateFinalOutput);
                return wrapper;
            }
            
            function showTemplateViewer(id) {
                const template = getFromCache(CACHE_KEYS.TEMPLATES).find(t => t.id === id);
                if (!template) return;

                currentTemplateId = id;
                const allPlaceholders = getFromCache(CACHE_KEYS.PLACEHOLDERS);
                const closingsData = allPlaceholders.find(p => p.key === 'closings');
                const closings = (closingsData && closingsData.options) ? closingsData.options : [{ value: 'Best regards' }];
                currentRandomClosing = closings[Math.floor(Math.random() * closings.length)].value;

                dom.viewerAgentNameInput.value = '';
                dom.viewerSuIdInput.value = '';
                dom.viewerManualSupplierNameInput.value = '';
                
                dom.viewerTitle.textContent = template.name;
                dom.viewerCategory.textContent = `Dự án: ${template.projects?.name || 'N/A'} / Danh mục: ${template.issue}`;
                const lastUpdated = template.updated_at || template.created_at;
                dom.viewerUpdatedDate.textContent = lastUpdated ? `Updated: ${new Date(lastUpdated).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric'})}` : '';
                dom.viewerDescription.textContent = template.description || '';
                dom.viewerDescription.classList.toggle('hidden', !template.description);

                const content = template.content || '';
                dom.placeholdersContainer.innerHTML = '';
                dom.optionalsContainer.innerHTML = '';
                
                const allPlaceholdersMap = new Map(allPlaceholders.map(p => [p.key, p]));
                const ignoredPlaceholders = new Set(['signature', 'Customer_Name', 'Order_Number', 'Brand']);
                const optionalBlockRegex = /\[\[(.*?)]]([\s\S]*?)\[\[\/\1]]/g;

                const basePlaceholders = [...new Set(Array.from(content.replace(optionalBlockRegex, '').matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g), m => m[1]))];
                basePlaceholders.forEach(pKey => {
                    if (!ignoredPlaceholders.has(pKey) && !pKey.startsWith('hom_nay')) {
                        dom.placeholdersContainer.appendChild(createPlaceholderInput(pKey, allPlaceholdersMap));
                    }
                });

                let match;
                while ((match = optionalBlockRegex.exec(content)) !== null) {
                    const [, optionalName, optionalContent] = match;
                    const optionalContainer = document.createElement('div');
                    optionalContainer.className = 'mb-2';
                    const checkboxId = `opt-${optionalName.replace(/\s/g, '-')}-${Math.random()}`;
                    
                    const nestedPlaceholdersDiv = document.createElement('div');
                    nestedPlaceholdersDiv.className = 'nested-placeholders pl-6 mt-2 border-l-2 border-dashed border-[rgb(var(--color-border))]';
                    const nestedPlaceholders = [...new Set(Array.from(optionalContent.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g), m => m[1]))];
                    nestedPlaceholders.forEach(pKey => {
                         if (!ignoredPlaceholders.has(pKey) && !pKey.startsWith('hom_nay')) {
                            nestedPlaceholdersDiv.appendChild(createPlaceholderInput(pKey, allPlaceholdersMap));
                        }
                    });

                    optionalContainer.innerHTML = `<div class="flex items-center"><input type="checkbox" id="${checkboxId}" data-optional="${optionalName}" checked class="h-4 w-4 text-[rgb(var(--color-accent-primary))] border-[rgb(var(--color-border))] rounded"><label for="${checkboxId}" class="ml-2 block text-sm">${optionalName}</label></div>`;
                    if (nestedPlaceholdersDiv.children.length === 0) nestedPlaceholdersDiv.classList.add('hidden');
                    optionalContainer.appendChild(nestedPlaceholdersDiv);
                    dom.optionalsContainer.appendChild(optionalContainer);

                    optionalContainer.querySelector('input').addEventListener('change', (e) => {
                        nestedPlaceholdersDiv.classList.toggle('hidden', !e.target.checked);
                        updateFinalOutput();
                    });
                }
                
                dom.dynamicOptionalFieldContainer.innerHTML = '';
                if (template.hasOptionalField && template.optionalFieldNames) {
                    const optionalFields = template.optionalFieldNames.split(',').map(s => s.trim()).filter(Boolean);
                    if (optionalFields.length > 0) dom.dynamicOptionalFieldContainer.innerHTML += `<h5 class="font-semibold mb-2">Trường tùy chọn:</h5>`;
                    optionalFields.forEach(fieldName => {
                        const div = document.createElement('div');
                        const checkboxId = `dyn-opt-check-${fieldName}`;
                        div.innerHTML = `
                            <div class="flex items-center">
                                <input type="checkbox" id="${checkboxId}" class="h-4 w-4 text-[rgb(var(--color-accent-primary))] border-[rgb(var(--color-border))] rounded">
                                <label for="${checkboxId}" class="ml-2 block text-sm font-medium">${fieldName.replace(/_/g, ' ')}</label>
                            </div>
                            <textarea data-placeholder="${fieldName}" class="hidden mt-2 w-full p-2 border border-[rgb(var(--color-border))] rounded-md bg-[rgb(var(--color-bg-primary))]" rows="3"></textarea>`;
                        dom.dynamicOptionalFieldContainer.appendChild(div);
                        const checkbox = div.querySelector(`#${checkboxId}`);
                        const textarea = div.querySelector('textarea');
                        checkbox.addEventListener('change', () => textarea.classList.toggle('hidden', !checkbox.checked));
                        [checkbox, textarea].forEach(el => el.addEventListener('input', updateFinalOutput));
                    });
                }
                
                const brandData = allPlaceholders.find(p => p.key === 'brand');
                if (brandData?.options) {
                    document.getElementById('customer-brand').innerHTML = brandData.options.map(opt => `<option value="${opt.value}">${opt.text}</option>`).join('');
                }

                dom.showMovementGuideBtn.classList.toggle('hidden', !(template.issue.toLowerCase() === 'movement' && template.movementGuide?.length > 0));
                dom.showFollowUpGuideBtn.classList.toggle('hidden', !(template.followUpGuide?.length > 0));
                showView('viewer');
                updateFinalOutput();
            }

            function updateFinalOutput() {
                const template = getFromCache(CACHE_KEYS.TEMPLATES).find(t => t.id === currentTemplateId);
                if (!template) return;
                
                let content = template.content || '';
                dom.optionalsContainer.querySelectorAll('input[type="checkbox"]:not(:checked)').forEach(cb => {
                    const optionalName = cb.dataset.optional;
                    if (optionalName) {
                        const regex = new RegExp(`\\[\\[${escapeRegExp(optionalName)}]][\\s\\S]*?\\[\\[\\/${escapeRegExp(optionalName)}]]`, 'g');
                        content = content.replace(regex, '');
                    }
                });
                content = content.replace(/\[\[\/?.*?]]/g, '');

                content = replaceGeneralPlaceholders(content);
                content = content.replace(/\{\{hom_nay\+2\}\}/g, () => formatDate(addBusinessDays(new Date(), 2)));
                
                const isSpecialIssue = ['mos', 'movement'].includes(template.issue.toLowerCase());
                let finalPlainText;

                if (isSpecialIssue) {
                    finalPlainText = content.trim();
                } else {
                    const signatures = getFromCache(CACHE_KEYS.SIGNATURES);
                    const selectedSignerId = localStorage.getItem(CACHE_KEYS.SELECTED_SIGNER_ID);
                    const selectedSignature = signatures.find(s => s.id == selectedSignerId) || signatures[0];
                    let signatureText = selectedSignature ? `${selectedSignature.name}\n${selectedSignature.title || ''}\n${selectedSignature.department || ''}`.trim() : '';
                    content = content.replace(/\{\{signature\}\}/g, signatureText);
                    
                    const settingsMap = new Map(getFromCache(CACHE_KEYS.SETTINGS).map(s => [s.key, s.value]));
                    const greetingPersonTpl = settingsMap.get('greeting_person')?.value || 'Hi {{name}},';
                    const greetingTeamTpl = settingsMap.get('greeting_team')?.value || 'Hi {{name}} Team,';
                    const agentName = toTitleCase(dom.viewerAgentNameInput.value.trim());
                    const manualName = dom.viewerManualSupplierNameInput.value.trim();
                    let greeting = '';
                    if (agentName) greeting = greetingPersonTpl.replace('{{name}}', agentName);
                    else if (dom.viewerSuIdInput.value.trim() && manualName) greeting = greetingTeamTpl.replace('{{name}}', toTitleCase(manualName));
                    
                    const footerText = settingsMap.get('footer_text')?.value || '';
                    const footerPart = (template.includeFooter && footerText) ? `\n\n${footerText}` : '';
                    
                    finalPlainText = `${greeting ? greeting + '\n\n' : ''}${content.trim()}${footerPart}\n\n${currentRandomClosing},\n${signatureText}`;
                }
                
                finalPlainText = finalPlainText.replace(/(https?:\/\/[^\s]+)([^\s])/g, '$1 $2');
                
                const plainTextForCopy = finalPlainText.trim();
                let htmlText = escapeHTML(plainTextForCopy)
                    .replace(/(https?:\/\/[^\s&<>"']+)/g, '<a href="$1" target="_blank" class="text-blue-500 hover:underline">$1</a>')
                    .replace(/\n/g, '<br>');
                
                if (!isSpecialIssue) {
                    const footerText = new Map(getFromCache(CACHE_KEYS.SETTINGS).map(s => [s.key, s.value])).get('footer_text')?.value || '';
                    if (footerText) {
                        const escapedFooter = escapeHTML(footerText).replace(/\n/g, '<br>');
                        htmlText = htmlText.replace(escapedFooter, `<i>${escapedFooter}</i>`);
                    }
                }
                
                dom.finalOutput.innerHTML = htmlText;
                dom.finalOutput.dataset.plainText = plainTextForCopy;
            }

            function updateCustomerEmailPreview() {
                const template = getFromCache(CACHE_KEYS.TEMPLATES).find(t => t.id === currentTemplateId);
                if (!template?.sendToCustomer) return;

                const custName = toTitleCase(document.getElementById('customer-name').value.trim());
                const orderNum = document.getElementById('customer-order').value.trim();
                const brand = document.getElementById('customer-brand').value;
                const replacements = { Customer_Name: custName, Order_Number: orderNum, Brand: brand };
                
                let subject = (template.customerSubject || '').replace(/\{\{(.*?)\}\}/g, (_, key) => replacements[key] || `{{${key}}}`);
                let body = (template.customerBody || '').replace(/\{\{(.*?)\}\}/g, (_, key) => replacements[key] || `{{${key}}}`);
                subject = replaceGeneralPlaceholders(subject);
                body = replaceGeneralPlaceholders(body);

                document.getElementById('customer-email-address-output').textContent = document.getElementById('customer-email').value.trim();
                document.getElementById('customer-email-subject-output').textContent = subject;
                const emailBodyOutput = document.getElementById('customer-email-body-output');
                emailBodyOutput.innerHTML = body.replace(/\n/g, '<br>');
                emailBodyOutput.dataset.plainText = body;
            }

function createGuideItemHTML(stepId, title = '', content = '') {
  const itemId = `guide-item-${stepId}-${Date.now()}`;
  const div = document.createElement('div');
  div.className = 'p-2 border border-[rgb(var(--color-border))] rounded-md bg-[rgb(var(--color-bg-secondary))] relative guide-item';
  div.id = itemId;
  div.innerHTML = `
    <button type="button" onclick="document.getElementById('${itemId}').remove()" class="absolute top-1 right-1 text-red-400 hover:text-red-600 font-bold text-lg">&times;</button>
    <input type="text" class="guide-item-title w-full p-1 border-b border-[rgb(var(--color-border))] mb-1 text-sm font-semibold bg-transparent" value="${title}" placeholder="Tên chỉ mục.">
    <textarea class="guide-item-content w-full p-1 text-sm bg-transparent" rows="2" placeholder="Nội dung/hướng dẫn.">${content}</textarea>
  `;
  return div;
}

function createGuideStepEditor(type, stepData = {}) {
  const stepId = `${type}-step-${Date.now()}`;
  const details = document.createElement('details');
  details.className = 'bg-white p-3 rounded-lg border guide-step-editor';
  details.open = true;

  if (type === 'follow-up') {
    details.innerHTML = `
      <summary class="flex justify-between items-center font-semibold cursor-pointer">
        <input type="text" class="guide-step-title flex-grow font-semibold bg-transparent" value="${stepData.title || ''}" placeholder="Tên bước.">
        <button type="button" class="remove-guide-step-btn text-red-500 hover:text-red-700 ml-2">&times;</button>
      </summary>
      <div class="mt-2">
        <textarea class="guide-item-action w-full p-1 text-sm bg-transparent border rounded" rows="2" placeholder="Hành động / Link.">${stepData.action || ''}</textarea>
      </div>`;
  } else {
    details.innerHTML = `
      <summary class="flex justify-between items-center font-semibold cursor-pointer">
        <input type="text" class="guide-step-title flex-grow font-semibold bg-transparent" value="${stepData.title || ''}" placeholder="Tiêu đề bước.">
        <button type="button" class="remove-guide-step-btn text-red-500 hover:text-red-700 ml-2">&times;</button>
      </summary>
      <div class="mt-3 space-y-3" id="guide-items-${stepId}"></div>
      <button type="button" data-step-id="${stepId}" class="add-guide-item-btn mt-3 text-sm bg-blue-100 hover:bg-blue-200 text-blue-800 font-semibold py-1 px-3 rounded-md">+ Thêm mục</button>`;

    const itemsContainer = details.querySelector(`#guide-items-${stepId}`);
    if (stepData.items && Array.isArray(stepData.items)) {
      stepData.items.forEach(item => itemsContainer.appendChild(createGuideItemHTML(stepId, item.title, item.content)));
    }
    details.querySelector('.add-guide-item-btn').addEventListener('click', (e) => {
      document.getElementById(`guide-items-${e.target.dataset.stepId}`).appendChild(createGuideItemHTML(e.target.dataset.stepId));
    });
  }

  details.querySelector('.remove-guide-step-btn').addEventListener('click', () => details.remove());
  return details;
}

            
            // --- Event Handlers & App Initialization ---
            async function initializeApp() {
                dom.appContainer.classList.remove('opacity-0');
                loadTheme();
                setupHelpAndTutorial();
                setupDataManager();
                setupSignatureSelection();
                
                dom.themeSwitcher.addEventListener('click', (e) => {
                    const button = e.target.closest('button[data-theme]');
                    if (button) applyTheme(button.dataset.theme);
                });

                dom.projectTabsContainer.addEventListener('click', (e) => {
                    const button = e.target.closest('button.project-tab');
                    if(button) {
                        currentProject = parseInt(button.dataset.projectId, 10);
                        currentIssue = null;
                        renderProjectTabs();
                        renderIssuesList();
                        renderTemplateList();
                        showView('welcome');
                    }
                });
                
                dom.issuesListContainer.addEventListener('click', (e) => {
                    const button = e.target.closest('button');
                    if (button) {
                        currentIssue = button.textContent;
                        dom.searchInput.value = ''; 
                        renderIssuesList();
                        renderTemplateList();
                    }
                });

                await initializeAppUI(); 
                await syncWithSupabase(); 

                dom.newTemplateBtn.addEventListener('click', () => showTemplateForm());
                dom.cancelBtn.addEventListener('click', () => showView('welcome'));
                
                dom.searchInput.addEventListener('input', (e) => {
                    const filter = e.target.value.trim().toLowerCase();
                    if (filter) {
                        currentIssue = null;
                        renderIssuesList();
                    }
                    renderTemplateList(filter);
                });

                dom.addMovementStepBtn.addEventListener('click', () => dom.movementGuideStepsContainer.appendChild(createGuideStepEditor('movement')));
                dom.addFollowUpStepBtn.addEventListener('click', () => dom.followUpGuideStepsContainer.appendChild(createGuideStepEditor('follow-up')));
                
                dom.editorForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const issue = dom.mainIssueInput.value.trim();
                    const name = dom.templateNameInput.value.trim();
                    const content = serializeEditorContent();
                    if (!issue || !name || !content) return showValidationModal(['Main Issue', 'Template Name', 'Main Content']);
                    
                    const getGuideData = (container, isSimple = false) => {
                        return Array.from(container.querySelectorAll('.guide-step-editor')).map(editor => {
                            const stepTitle = editor.querySelector('.guide-step-title').value.trim();
                            if (!stepTitle) return null;
                            const stepData = { title: stepTitle };
                            if(isSimple) {
                                stepData.action = editor.querySelector('.guide-item-action').value.trim();
                            } else {
                                stepData.items = Array.from(editor.querySelectorAll('.guide-item')).map(itemDiv => ({
                                    title: itemDiv.querySelector('.guide-item-title').value.trim(),
                                    content: itemDiv.querySelector('.guide-item-content').value.trim()
                                })).filter(item => item.title);
                            }
                            return stepData;
                        }).filter(Boolean);
                    };
                    
                    const templateData = {
                        project: currentProject, issue, name, content,
                        description: dom.templateDescriptionInput.value.trim(),
                        updated_at: new Date().toISOString(),
                        sendToCustomer: dom.sendToCustomerCheckbox.checked, includeFooter: dom.includeFooterCheckbox.checked,
                        addLabelReminder: dom.addLabelReminderCheckbox.checked, addInternalComment: dom.addInternalCommentCheckbox.checked,
                        hasOptionalField: dom.addOptionalFieldCheckbox.checked,
                        labelName: dom.labelNameInput.value.trim() || null,
                        internalComment: dom.internalCommentBodyInput.value.trim() || null,
                        optionalFieldNames: dom.optionalFieldNameInput.value.trim() || null,
                        customerSubject: dom.customerSubjectInput.value.trim() || null,
                        customerBody: dom.customerBodyInput.value.trim() || null,
                        movementGuide: getGuideData(dom.movementGuideStepsContainer),
                        followUpGuide: dom.addFollowUpCheckbox.checked ? getGuideData(dom.followUpGuideStepsContainer, true) : null
                    };

                    const id = dom.templateIdInput.value;
                    const { error } = id ? await supabase.from('templates').update(templateData).eq('id', id) : await supabase.from('templates').insert(templateData);
                    if(error) return showNotification(`Error saving template: ${error.message}`, 'error');

                    showNotification('Template saved successfully!', 'success');
                    currentIssue = issue;
                    await syncWithSupabase();
                    showView('welcome');
                });

                dom.copyBtn.addEventListener('click', async () => {
                    const missing = [];
                    if (!dom.viewerAgentNameInput.value.trim() && !dom.viewerSuIdInput.value.trim()) {
                        missing.push("Agent Name or SuID");
                    }
                    if (!dom.viewerManualSupplierContainer.classList.contains('hidden') && !dom.viewerManualSupplierNameInput.value.trim()) {
                        missing.push("Manual Supplier Name");
                    }
                    document.querySelectorAll('.placeholder-input-wrapper').forEach(wrapper => {
                        if (!wrapper.closest('.nested-placeholders.hidden')) {
                            const input = wrapper.querySelector('[data-placeholder]');
                            if (input && !input.value.trim()) missing.push(input.dataset.placeholder.replace(/_/g, ' '));
                        }
                    });
                     document.querySelectorAll('#dynamic-optional-field-container input[type="checkbox"]:checked').forEach(cb => {
                        const textarea = cb.closest('div').nextElementSibling;
                        if (textarea && !textarea.value.trim()) missing.push(textarea.dataset.placeholder.replace(/_/g, ' '));
                    });

                    if (missing.length > 0) return showValidationModal([...new Set(missing)]);

                    copyRichTextToClipboard(dom.finalOutput, dom.copyFeedback);
                    const template = getFromCache(CACHE_KEYS.TEMPLATES).find(t => t.id === currentTemplateId);
                    if (!template) return;
                    
                    if (template.followUpGuide) await openFollowUpGuideModal(template.followUpGuide);
                    if (template.addLabelReminder && template.labelName) await openLabelReminderModal(template.labelName);
                    if (template.sendToCustomer) await openCustomerModal();
                    if (template.issue.toLowerCase() === 'movement' && template.addInternalComment && template.internalComment) {
                        await openInternalCommentModal(replaceGeneralPlaceholders(template.internalComment));
                    }
                });
                
                dom.showMovementGuideBtn.addEventListener('click', () => {
                    const template = getFromCache(CACHE_KEYS.TEMPLATES).find(t => t.id === currentTemplateId);
                    if (template?.movementGuide) openMovementGuideModal(template.movementGuide);
                });
                dom.showFollowUpGuideBtn.addEventListener('click', () => {
                    const template = getFromCache(CACHE_KEYS.TEMPLATES).find(t => t.id === currentTemplateId);
                    if (template?.followUpGuide) openFollowUpGuideModal(template.followUpGuide);
                });

                [dom.viewerAgentNameInput, dom.viewerManualSupplierNameInput].forEach(el => el.addEventListener('input', updateFinalOutput));
                dom.viewerSuIdInput.addEventListener('input', debounce(async (e) => {
                    const suid = e.target.value.trim();
                    if (!suid) { dom.viewerManualSupplierContainer.classList.add('hidden'); dom.viewerManualSupplierNameInput.value = ''; updateFinalOutput(); return; }
                    const companyName = await searchSupplierName(suid);
                    dom.viewerManualSupplierContainer.classList.toggle('hidden', !!companyName);
                    dom.viewerManualSupplierNameInput.value = companyName || '';
                    updateFinalOutput();
                }, 500)); 

                [dom.mainIssueInput, dom.sendToCustomerCheckbox, dom.addLabelReminderCheckbox, dom.addOptionalFieldCheckbox, dom.addInternalCommentCheckbox, dom.addFollowUpCheckbox].forEach(el => el.addEventListener('input', updateFormVisibility));
                ['customer-email', 'customer-name', 'customer-order', 'customer-brand'].forEach(id => document.getElementById(id).addEventListener('input', updateCustomerEmailPreview));
                document.getElementById('copy-cust-email-addr-btn').addEventListener('click', () => copyPlainTextToClipboard(document.getElementById('customer-email-address-output').textContent, document.getElementById('customer-copy-feedback')));
                document.getElementById('copy-cust-subject-btn').addEventListener('click', () => copyPlainTextToClipboard(document.getElementById('customer-email-subject-output').textContent, document.getElementById('customer-copy-feedback')));
                document.getElementById('copy-cust-body-btn').addEventListener('click', () => copyPlainTextToClipboard(document.getElementById('customer-email-body-output').dataset.plainText, document.getElementById('customer-copy-feedback')));
                document.getElementById('copy-internal-comment-btn').addEventListener('click', () => copyPlainTextToClipboard(document.getElementById('internal-comment-output').dataset.plainText, document.getElementById('internal-comment-copy-feedback')));
            }
            
            // --- Data Manager ---
            function setupDataManager() {
                dom.openDataManagerBtn.addEventListener('click', () => { _openModal(dom.dataManagerModal); switchTab('snippets'); });
                dom.closeDataManagerBtn.addEventListener('click', () => _closeModal(dom.dataManagerModal));
                dom.dataManagerTabs.addEventListener('click', (e) => { if (e.target.matches('.tab-button')) switchTab(e.target.dataset.tab); });
                document.getElementById('save-snippets-btn').addEventListener('click', async () => {
                    const snippets = [ { key: 'footer_text', value: { value: document.getElementById('footer-text-input').value }}, { key: 'greeting_person', value: { value: document.getElementById('greeting-person-input').value }}, { key: 'greeting_team', value: { value: document.getElementById('greeting-team-input').value }} ];
                    const { error } = await supabase.from('settings').upsert(snippets, { onConflict: 'key' });
                    if (error) showNotification(`Error saving snippets: ${error.message}`, 'error'); else { showNotification('Snippets saved.', 'success'); await syncWithSupabase(); }
                });
                document.querySelectorAll('.export-btn').forEach(btn => btn.addEventListener('click', () => {
                    const storeName = btn.dataset.store;
                    const data = getFromCache(CACHE_KEYS[storeName.toUpperCase()]).map(({ created_at, ...rest}) => rest);
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
                    a.download = `${storeName}_export.json`; a.click(); URL.revokeObjectURL(a.href);
                }));
                document.querySelectorAll('.import-file-input').forEach(input => input.addEventListener('change', (e) => {
                    const file = e.target.files[0]; if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        try { pendingImportData = JSON.parse(event.target.result); _openModal(dom.importOptionsModal); dom.importOptionsModal.dataset.store = e.target.dataset.store; } 
                        catch (err) { alert(`Error reading file: ${err.message}`); }
                    };
                    reader.readAsText(file); e.target.value = '';
                }));
                const importAction = (mode) => { handleDataImport(dom.importOptionsModal.dataset.store, pendingImportData, mode); _closeModal(dom.importOptionsModal); };
                document.getElementById('import-merge-btn').addEventListener('click', () => importAction('merge'));
                document.getElementById('import-replace-btn').addEventListener('click', () => importAction('replace'));
                document.getElementById('import-cancel-btn').addEventListener('click', () => _closeModal(dom.importOptionsModal));
                document.getElementById('add-project-btn').addEventListener('click', async () => {
                    const name = document.getElementById('new-project-name').value.trim().toUpperCase();
                    if (name) { await supabase.from('projects').insert({ name, color: '#6B7280' }); await syncWithSupabase(); document.getElementById('new-project-name').value = ''; }
                });
                document.getElementById('add-signature-btn').addEventListener('click', async () => {
                    const name = document.getElementById('new-signature-name').value.trim();
                    if (name) { const { count } = await supabase.from('signatures').select('*', { count: 'exact', head: true }); await supabase.from('signatures').insert({ name, isDefault: count === 0 }); await syncWithSupabase(); document.getElementById('new-signature-name').value = ''; }
                });
                document.getElementById('import-csv-input').addEventListener('change', (e) => handleCsvImport(e.target.files[0]));
                document.getElementById('add-new-placeholder-btn').addEventListener('click', () => renderPlaceholderEditor(null));
                document.getElementById('load-default-data-btn').addEventListener('click', async () => {
                    if(!confirm("This will add default data. It may overwrite existing entries. Continue?")) return;
                    showNotification('Loading default data...', 'info');
                    const defaultData = getDefaultData();
                    await supabase.from('settings').upsert(defaultData.settings, { onConflict: 'key' });
                    await supabase.from('projects').upsert(defaultData.projects, { onConflict: 'name' });
                    await supabase.from('signatures').upsert(defaultData.signatures, { onConflict: 'name' });
                    await supabase.from('placeholders').upsert(defaultData.placeholders, { onConflict: 'key' });
                    const { data: projects } = await supabase.from('projects').select('id, name');
                    const projectMap = new Map(projects.map(p => [p.name, p.id]));
                    for(const tpl of defaultData.templates) {
                        tpl.project = projectMap.get(tpl.project_name_for_seeding); delete tpl.project_name_for_seeding;
                        await supabase.from('templates').insert(tpl);
                    }
                    showNotification('Default data loaded!', 'success'); await syncWithSupabase();
                });
                document.getElementById('delete-all-my-data-btn').addEventListener('click', async () => {
                    if(prompt("This is irreversible. To confirm, type DELETE ALL DATA below:") !== "DELETE ALL DATA") return;
                    showNotification('Deleting all data...', 'info');
                    const tables = ['templates', 'projects', 'signatures', 'placeholders', 'settings', 'suppliers', 'children'];
                    for (const table of tables) { const { data } = await supabase.from(table).select('id'); if (data?.length > 0) await supabase.from(table).delete().in('id', data.map(d => d.id)); }
                    showNotification('All application data deleted.', 'success'); await syncWithSupabase();
                });
            }
            async function handleDataImport(storeName, data, mode) {
                 if (mode === 'replace') { const { data: ids } = await supabase.from(storeName).select('id'); if (ids?.length > 0) await supabase.from(storeName).delete().in('id', ids.map(i => i.id)); }
                const { error } = await supabase.from(storeName).upsert(data);
                if (error) showNotification(`Error importing to ${storeName}: ${error.message}`, 'error'); else { showNotification(`Imported to ${storeName}.`, 'success'); await syncWithSupabase(); }
            }
            async function switchTab(tabName) {
                document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
                document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
                document.getElementById(`tab-content-${tabName}`).classList.remove('hidden');
                document.querySelector(`.tab-button[data-tab="${tabName}"]`).classList.add('active');
                switch (tabName) {
                    case 'snippets': renderSnippetsTab(); break;
                    case 'projects': renderProjectsTable(); break;
                    case 'templates': renderTemplatesTable(); break;
                    case 'signatures': renderSignaturesTable(); break;
                    case 'placeholders': renderPlaceholdersTab(); break;
                    case 'suppliers': renderSuppliersStatus(); break;
                }
            }
            function renderSnippetsTab() {
                const settingsMap = new Map(getFromCache(CACHE_KEYS.SETTINGS).map(s => [s.key, s.value]));
                document.getElementById('footer-text-input').value = settingsMap.get('footer_text')?.value || '';
                document.getElementById('greeting-person-input').value = settingsMap.get('greeting_person')?.value || '';
                document.getElementById('greeting-team-input').value = settingsMap.get('greeting_team')?.value || '';
            }
            function renderProjectsTable() {
                const container = document.getElementById('projects-table');
                const data = getFromCache(CACHE_KEYS.PROJECTS);
                container.innerHTML = !data?.length ? `<p>No data.</p>` : `<table class="w-full border-collapse"><thead><tr class="bg-[rgb(var(--color-bg-secondary))]"><th class="p-2 border text-left">Project Name</th><th class="p-2 border text-left">Color</th><th class="p-2 border text-left">Actions</th></tr></thead><tbody>${data.map(p => `<tr><td class="p-2 border">${p.name}</td><td class="p-2 border"><input type="color" value="${p.color||'#6B7280'}" data-id="${p.id}" class="project-color-picker w-full h-8"></td><td class="p-2 border"><button class="text-red-500 hover:underline" data-id="${p.id}">Delete</button></td></tr>`).join('')}</tbody></table>`;
                container.onclick = async (e) => { if(e.target.matches('button') && confirm('Are you sure?')) { await supabase.from('projects').delete().eq('id', e.target.dataset.id); await syncWithSupabase(); }};
                container.onchange = async (e) => { if(e.target.matches('.project-color-picker')) { await supabase.from('projects').update({ color: e.target.value }).eq('id', e.target.dataset.id); await syncWithSupabase(); }};
            }
            function renderTemplatesTable() {
                const container = document.getElementById('templates-table');
                const templates = getFromCache(CACHE_KEYS.TEMPLATES);
                container.innerHTML = !templates?.length ? `<p>No data.</p>` : `<table class="w-full border-collapse"><thead><tr class="bg-[rgb(var(--color-bg-secondary))]"><th class="p-2 border text-left">Name</th><th class="p-2 border text-left">Project</th><th class="p-2 border text-left">Category</th><th class="p-2 border text-left">Actions</th></tr></thead><tbody>${templates.map(t => `<tr><td class="p-2 border">${t.name}</td><td class="p-2 border">${t.projects?.name || 'N/A'}</td><td class="p-2 border">${t.issue}</td><td class="p-2 border"><button class="text-red-500 hover:underline" data-id="${t.id}">Delete</button></td></tr>`).join('')}</tbody></table>`;
                container.onclick = async (e) => { if(e.target.matches('button') && confirm('Are you sure?')) { await supabase.from('templates').delete().eq('id', e.target.dataset.id); await syncWithSupabase(); }};
            }
            function renderSignaturesTable() {
                const container = document.getElementById('signatures-table');
                const data = getFromCache(CACHE_KEYS.SIGNATURES);
                container.innerHTML = !data?.length ? `<p>No data.</p>` : `<table class="w-full border-collapse"><thead><tr class="bg-[rgb(var(--color-bg-secondary))]"><th class="p-2 border text-left">Name</th><th class="p-2 border text-left">Status</th><th class="p-2 border text-left">Actions</th></tr></thead><tbody>${data.map(s => `<tr><td class="p-2 border">${s.name}</td><td class="p-2 border">${s.isDefault ? '<span class="font-bold text-green-600">Default</span>' : ''}</td><td class="p-2 border space-x-2">${!s.isDefault ? `<button class="text-blue-500 hover:underline" data-action="setDefault" data-id="${s.id}">Set Default</button>` : ''}<button class="text-red-500 hover:underline" data-action="delete" data-id="${s.id}">Delete</button></td></tr>`).join('')}</tbody></table>`;
                container.onclick = async (e) => {
                    const btn = e.target.closest('button'); if (!btn) return;
                    const { action, id } = btn.dataset;
                    if (action === 'delete' && confirm('Are you sure?')) await supabase.from('signatures').delete().eq('id', id);
                    if (action === 'setDefault') { await supabase.from('signatures').update({isDefault: false}).neq('id', -1); await supabase.from('signatures').update({isDefault: true}).eq('id', id); }
                    await syncWithSupabase();
                };
            }
            function renderPlaceholdersTab() {
                const container = document.getElementById('placeholders-list-manager');
                const placeholders = getFromCache(CACHE_KEYS.PLACEHOLDERS).sort((a,b) => a.key.localeCompare(b.key));
                container.innerHTML = placeholders.map(p => `<button class="w-full text-left p-2 rounded-md hover:bg-[rgb(var(--color-bg-tertiary))] focus:bg-blue-100 focus:font-semibold" data-key="${p.key}">${p.key}</button>`).join('');
                document.getElementById('placeholder-editor-container').innerHTML = `<div class="flex items-center justify-center h-full text-center text-[rgb(var(--color-text-muted))]"><p>Select a placeholder to edit, or create a new one.</p></div>`;
                container.onclick = (e) => {
                    const btn = e.target.closest('button'); if (!btn) return;
                    document.querySelectorAll('#placeholders-list-manager button').forEach(b => b.classList.remove('bg-blue-100', 'font-semibold'));
                    btn.classList.add('bg-blue-100', 'font-semibold'); renderPlaceholderEditor(btn.dataset.key);
                };
            }
            function renderPlaceholderEditor(key) {
                const container = document.getElementById('placeholder-editor-container');
                const p = key ? getFromCache(CACHE_KEYS.PLACEHOLDERS).find(ph => ph.key === key) : null;
                container.innerHTML = `<div class="space-y-4 p-4 border border-[rgb(var(--color-border))] rounded-lg"><h3 class="text-xl font-semibold">${key?`Edit '{{${key}}}'`:'Create New Placeholder'}</h3><div><label for="placeholder-key" class="block text-sm font-medium mb-1">Key (name inside <code>{{...}}</code>)</label><input type="text" id="placeholder-key" class="w-full p-2 border rounded-lg bg-[rgb(var(--color-bg-primary))]" value="${key||''}" ${key?'readonly':''} placeholder="example_key"></div><div><label for="placeholder-type" class="block text-sm font-medium mb-1">Type</label><select id="placeholder-type" class="w-full p-2 border rounded-lg bg-[rgb(var(--color-bg-primary))]"><option value="entry" ${p?.type==='entry'?'selected':''}>Data Entry</option><option value="droplist" ${p?.type==='droplist'?'selected':''}>Droplist</option><option value="date" ${p?.type==='date'?'selected':''}>Date</option></select></div><div><label for="placeholder-description" class="block text-sm font-medium mb-1">Description / Instructions</label><textarea id="placeholder-description" rows="4" class="w-full p-2 border rounded-lg bg-[rgb(var(--color-bg-primary))]" placeholder="Enter instructions for the user...">${p?.description||''}</textarea></div><div id="placeholder-options-manager" class="hidden"><h4 class="font-semibold mb-2">Options</h4><div id="placeholder-options-table" class="mb-2 max-h-40 overflow-y-auto"></div><div class="grid grid-cols-1 md:grid-cols-3 gap-2 p-2 bg-[rgb(var(--color-bg-secondary))] rounded-md"><input type="text" id="new-option-value" placeholder="Value" class="p-2 border rounded-md bg-[rgb(var(--color-bg-primary))]"><input type="text" id="new-option-text" placeholder="Display Text (optional)" class="p-2 border rounded-md bg-[rgb(var(--color-bg-primary))]"><button id="add-option-btn" class="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg">Add</button></div></div><div class="flex justify-end gap-3 pt-2">${key?`<button id="delete-placeholder-btn" class="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg">Delete</button>`:''}<button id="save-placeholder-btn" class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg">Save</button></div></div>`;
                const typeSelect = container.querySelector('#placeholder-type');
                const optionsManager = container.querySelector('#placeholder-options-manager');
                const toggleOptions = () => optionsManager.classList.toggle('hidden', typeSelect.value !== 'droplist');
                typeSelect.onchange = toggleOptions;
                if (p?.type === 'droplist') renderPlaceholderOptionsTable(p.options || []);
                toggleOptions();
                container.querySelector('#add-option-btn').onclick = () => {
                    const valInput = container.querySelector('#new-option-value'); const txtInput = container.querySelector('#new-option-text');
                    const value = valInput.value.trim(); const text = txtInput.value.trim() || value;
                    if (value) {
                        const row = container.querySelector('#placeholder-options-table tbody').insertRow();
                        row.innerHTML = `<td class="p-2 border">${value}</td><td class="p-2 border">${text}</td><td class="p-2 border text-center"><button class="text-red-500 hover:underline">Xóa</button></td>`;
                        row.querySelector('button').onclick = () => row.remove();
                        valInput.value = ''; txtInput.value = '';
                    }
                };
                container.querySelector('#save-placeholder-btn').onclick = handleSavePlaceholder;
                if (key) container.querySelector('#delete-placeholder-btn').onclick = () => handleDeletePlaceholder(key);
            }
            function renderPlaceholderOptionsTable(options) {
                const container = document.getElementById('placeholder-options-table');
                container.innerHTML = `<table class="w-full border-collapse text-sm"><thead><tr class="bg-[rgb(var(--color-bg-tertiary))]"><th class="p-2 border text-left">Value</th><th class="p-2 border text-left">Text</th><th class="w-16 p-2 border"></th></tr></thead><tbody>${(options||[]).map(opt=>`<tr><td class="p-2 border">${opt.value}</td><td class="p-2 border">${opt.text}</td><td class="p-2 border text-center"><button class="text-red-500 hover:underline">Xóa</button></td></tr>`).join('')}</tbody></table>`;
                container.querySelectorAll('tbody button').forEach(btn => btn.onclick = (e) => e.target.closest('tr').remove());
            }
            async function handleSavePlaceholder() {
                const keyInput = document.getElementById('placeholder-key');
                const key = keyInput.value.trim().toLowerCase().replace(/\s+/g, '_');
                if (!key) return showNotification('Key cannot be empty.', 'error');
                if (!keyInput.readOnly && getFromCache(CACHE_KEYS.PLACEHOLDERS).some(p => p.key === key)) return showNotification(`Placeholder key "${key}" already exists.`, 'error');
                const data = { key, type: document.getElementById('placeholder-type').value, description: document.getElementById('placeholder-description').value.trim(), options: document.getElementById('placeholder-type').value==='droplist' ? Array.from(document.querySelectorAll('#placeholder-options-table tbody tr')).map(r=>({value:r.cells[0].textContent, text:r.cells[1].textContent})) : null };
                const { error } = await supabase.from('placeholders').upsert(data, { onConflict: 'key' });
                if (error) showNotification(`Error: ${error.message}`, 'error'); else { showNotification('Placeholder saved.', 'success'); await syncWithSupabase(); }
            }
            async function handleDeletePlaceholder(key) { if (confirm(`Delete placeholder '{{${key}}}'?`)) { await supabase.from('placeholders').delete().eq('key', key); await syncWithSupabase(); }}
            async function renderSuppliersStatus() {
                const { count: parentCount } = await supabase.from('suppliers').select('*', { count: 'exact', head: true });
                const { count: childCount } = await supabase.from('children').select('*', { count: 'exact', head: true });
                document.getElementById('csv-feedback').textContent = `Database status: ${parentCount} parent suppliers, ${childCount} child suppliers.`;
            }

            // --- Utilities ---
            const toTitleCase = (str) => str ? str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()) : '';
            const hexToRgb = (hex) => { const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex); return r ? `${parseInt(r[1], 16)} ${parseInt(r[2], 16)} ${parseInt(r[3], 16)}` : null; };
            const debounce = (func, delay) => { let timeout; return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), delay); }; };
            const escapeHTML = (str) => str.replace(/[&<>"']/g, (match) => ({'&': '&amp;','<': '&lt;','>': '&gt;','"': '&quot;',"'": '&#39;'}[match]));
            function applyTheme(theme) { document.documentElement.className = theme === 'dark' ? 'dark' : (theme === 'yellow' ? 'theme-yellow' : ''); localStorage.setItem('ticketManagerTheme', theme); document.querySelectorAll('#theme-switcher button').forEach(btn => btn.style.boxShadow = `0 0 0 2px ${theme===btn.dataset.theme?'rgb(var(--color-accent-primary))':'transparent'}`); }
            function loadTheme() { applyTheme(localStorage.getItem('ticketManagerTheme') || 'light'); }
            function showNotification(message, type = 'info') { const t = dom.notificationToast; t.textContent = message; t.className = `fixed bottom-5 right-5 text-white py-2 px-4 rounded-lg shadow-lg transition-all duration-300 z-50 ${type==='success'?'bg-green-600':type==='error'?'bg-red-600':'bg-gray-800'}`; t.classList.remove('opacity-0','translate-y-4'); setTimeout(() => t.classList.add('opacity-0','translate-y-4'), 3000); }
            const _openModal = (modal) => { modal.classList.remove('hidden'); setTimeout(() => { modal.classList.remove('opacity-0'); modal.querySelector('.modal-content').classList.remove('scale-95'); }, 10); };
            const _closeModal = (modal) => { modal.classList.add('opacity-0'); modal.querySelector('.modal-content').classList.add('scale-95'); setTimeout(() => modal.classList.add('hidden'), 300); };
            const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const addBusinessDays = (startDate, days) => { let d = new Date(startDate); let a = 0; while (a < days) { d.setDate(d.getDate() + 1); if (d.getDay() % 6 !== 0) a++; } return d; };
            const formatDate = (date) => {
                if (!(date instanceof Date) || isNaN(date)) return '';
                const month = String(date.getUTCMonth() + 1).padStart(2, '0');
                const day = String(date.getUTCDate()).padStart(2, '0');
                const year = date.getUTCFullYear();
                return `${month}/${day}/${year}`;
            };
            function timeAgo(dateString) {
                if (!dateString) return '';
                const date = new Date(dateString);
                const seconds = Math.floor((new Date() - date) / 1000);
                const intervals = { year: 31536000, month: 2592000, day: 86400, hour: 3600, minute: 60 };
                for (let unit in intervals) {
                    const interval = Math.floor(seconds / intervals[unit]);
                    if (interval > 1) return `${interval} ${unit}s ago`;
                }
                return 'just now';
            }
            function copyRichTextToClipboard(element, feedbackElement) {
                const plainText = element.dataset.plainText || element.innerText;
                const listener = (e) => { e.preventDefault(); e.clipboardData.setData('text/html', element.innerHTML); e.clipboardData.setData('text/plain', plainText); };
                document.addEventListener('copy', listener);
                try { document.execCommand('copy'); showCopyFeedback(feedbackElement); } 
                catch (e) { console.error('Copy failed', e); showNotification('Copy failed.', 'error'); } 
                finally { document.removeEventListener('copy', listener); }
            }
            function copyPlainTextToClipboard(text, feedbackElement) {
                const textArea = document.createElement("textarea"); textArea.value = text;
                textArea.style.position = "fixed"; textArea.style.left = "-9999px";
                document.body.appendChild(textArea); textArea.select();
                try { document.execCommand('copy'); if (feedbackElement) showCopyFeedback(feedbackElement); } 
                catch (err) { console.error('Fallback copy failed', err); showNotification('Copy failed.', 'error'); }
                document.body.removeChild(textArea);
            }
            function showCopyFeedback(element) { element.classList.remove('opacity-0'); setTimeout(() => element.classList.add('opacity-0'), 2000); }
            async function searchSupplierName(suid) {
                if (!suid) return null;
                let { data: supplier } = await supabase.from('suppliers').select('suname').eq('suid', suid).single();
                if (supplier) return supplier.suname;
                let { data: child } = await supabase.from('children').select('parentSuid').eq('suchildid', suid).single();
                if (child?.parentSuid) { let { data: parent } = await supabase.from('suppliers').select('suname').eq('suid', child.parentSuid).single(); if (parent) return parent.suname; }
                return null;
            }
            function openGuideModal(modalId, outputId, guideData, buttonId) {
                 return new Promise(r => { 
                    const modal = document.getElementById(modalId); const output = document.getElementById(outputId); output.innerHTML = ''; 
                    guideData.forEach(step => { output.innerHTML += `<div class="p-3 rounded-lg border bg-[rgb(var(--color-bg-secondary))]"><h3 class="font-bold text-lg">${step.title}</h3>${modalId.includes('follow-up')?`<div class="pl-4 text-sm whitespace-pre-wrap mt-2">${(step.action||'N/A').replace(/(https?:\/\/[^\s]+)/g,'<a href="$1" target="_blank" class="text-blue-500 hover:underline">$1</a>')}</div>`:step.items?.length>0?`<ul class="mt-2 list-disc list-inside space-y-2">${step.items.map(item=>`<li><strong>${item.title}:</strong><div class="pl-4 text-sm whitespace-pre-wrap">${item.content||'N/A'}</div></li>`).join('')}</ul>`:`<p class="text-muted italic mt-2">No items.</p>`}</div>`; });
                    _openModal(modal); document.getElementById(buttonId).onclick = () => { _closeModal(modal); r(); }; 
                });
            }
            const openMovementGuideModal = (guide) => openGuideModal('movement-guide-modal', 'movement-guide-output', guide, 'close-movement-guide-modal-btn');
            const openFollowUpGuideModal = (guide) => openGuideModal('follow-up-guide-modal', 'follow-up-guide-output', guide, 'close-follow-up-guide-modal-btn');
            const openLabelReminderModal = (label) => new Promise(r => { const m = document.getElementById('label-reminder-modal'); document.getElementById('label-reminder-text').textContent = `Remember to add the "${label}" label to the ticket!`; _openModal(m); document.getElementById('close-label-reminder-modal-btn').onclick = () => { _closeModal(m); r(); }; });
            const openCustomerModal = () => new Promise(r => { const m = document.getElementById('customer-email-modal'); ['customer-email', 'customer-name', 'customer-order'].forEach(id=>document.getElementById(id).value=''); updateCustomerEmailPreview(); _openModal(m); document.getElementById('close-customer-modal-btn').onclick = () => { _closeModal(m); r(); }; });
            const openInternalCommentModal = (comment) => new Promise(r => { const m = document.getElementById('internal-comment-modal'); const out = document.getElementById('internal-comment-output'); out.innerHTML = comment.replace(/\n/g, '<br>'); out.dataset.plainText = comment; _openModal(m); document.getElementById('close-internal-comment-modal-btn').onclick = () => { _closeModal(m); r(); }; });
            const showValidationModal = (missing) => { const m=document.getElementById('validation-modal'); document.getElementById('missing-fields-list').innerHTML=missing.map(f=>`<li>${f}</li>`).join(''); _openModal(m); document.getElementById('close-validation-modal-btn').onclick = () => _closeModal(m); };
            function setupSignatureSelection() {
                dom.changeSignerBtn.addEventListener('click', openSignatureSelectionModal);
                dom.signatureConfirmBtn.addEventListener('click', () => {
                    const selectedId = dom.signatureSelectDropdown.value;
                    if (selectedId) { localStorage.setItem(CACHE_KEYS.SELECTED_SIGNER_ID, selectedId); renderCurrentSigner(); _closeModal(dom.signatureSelectionModal); } 
                    else { showNotification('Please select a signature.', 'error'); }
                });
            }
            function openSignatureSelectionModal() {
                const signatures = getFromCache(CACHE_KEYS.SIGNATURES);
                if (!signatures?.length) return showNotification('No signatures found. Please add one first.', 'error');
                dom.signatureSelectDropdown.innerHTML = signatures.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
                dom.signatureSelectDropdown.value = localStorage.getItem(CACHE_KEYS.SELECTED_SIGNER_ID) || '';
                _openModal(dom.signatureSelectionModal);
            }
            async function initializeAppUI() { renderCurrentSigner(); renderProjectTabs(); renderIssuesList(); renderTemplateList(); showView('welcome'); }
            function setupHelpAndTutorial() {
                dom.helpContent.innerHTML = `<h2>Welcome!</h2><p>This tool helps you draft emails quickly. All your data is stored securely in the cloud.</p><h3>Key Features</h3><ul><li><strong>Centralized Data:</strong> Data is stored on Supabase, accessible from anywhere.</li><li><strong>Cloud Data Management:</strong> Your templates, projects, and signatures are synced.</li><li><strong>Advanced Editor:</strong> Use placeholders and optional paragraphs (scenarios) to create flexible templates.</li></ul>`;
                dom.openHelpBtn.addEventListener('click', () => _openModal(dom.helpModal));
                dom.closeHelpModalBtn.addEventListener('click', () => _closeModal(dom.helpModal));
                document.querySelectorAll('.modal-backdrop').forEach(m => m.addEventListener('click', e => { if (e.target === m) _closeModal(m); }));
            }
            
            function replaceGeneralPlaceholders(text) {
                let p = text;
                document.querySelectorAll('[data-placeholder]').forEach(input => {
                    let value = input.value;
                    if (input.type === 'date' && value) {
                        const dateParts = value.split('-');
                        const date = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));
                        value = formatDate(date);
                    }
                    p = p.replace(new RegExp(`\\{\\{${escapeRegExp(input.dataset.placeholder)}\\}\\}`, 'g'), value);
                });
                return p;
            };

            function setupInteractiveEditor(content) {
                dom.templateContentTextarea.value = content;
                dom.componentSource.innerHTML = [ { type: 'placeholder-entry', label: 'Placeholder (Text)', icon: 'T' }, { type: 'placeholder-droplist', label: 'Placeholder (List)', icon: '▼' }, { type: 'placeholder-date', label: 'Placeholder (Date)', icon: '📅' }, { type: 'scenario', label: 'Optional Paragraph', icon: '¶' }, ].map(c => `<div class="component-item" data-type="${c.type}"><span class="font-bold text-lg text-[rgb(var(--color-accent-primary))]">${c.icon}</span><span>${c.label}</span></div>`).join('');
                dom.componentSource.onclick = async (e) => {
                    const item = e.target.closest('.component-item'); if (!item) return;
                    const { type } = item.dataset; const textarea = dom.templateContentTextarea;
                    if (type.startsWith('placeholder')) {
                        const pType = type.split('-')[1];
                        const options = getFromCache(CACHE_KEYS.PLACEHOLDERS).filter(p => p.type === pType);
                        if (!options.length) return showNotification(`No placeholders of type '${pType}' found.`, 'error');
                        const result = await showComponentSelectModal(pType, options);
                        if (result) insertTextAtCursor(textarea, `{{${result}}}`);
                    } else if (type === 'scenario') {
                        const name = prompt("Enter a name for the optional paragraph:", "Optional Section");
                        if (name) insertTextAtCursor(textarea, `[[${name}]]\n\n[[/${name}]]`);
                    }
                    textarea.focus();
                };
            }
            function showComponentSelectModal(title, options) {
                return new Promise(resolve => {
                    const m = document.getElementById('component-select-modal');
                    document.getElementById('component-modal-title').textContent = `Select ${title} Placeholder`;
                    const select = document.getElementById('component-modal-select');
                    select.innerHTML = `<option value="">-- Select an option --</option>${options.map(o=>`<option value="${o.key}">${o.key}</option>`).join('')}`;
                    const confirmBtn = document.getElementById('component-modal-confirm');
                    const cancelBtn = document.getElementById('component-modal-cancel');
                    const onConfirm = () => { resolve(select.value || null); cleanup(); };
                    const onCancel = () => { resolve(null); cleanup(); };
                    const cleanup = () => { confirmBtn.removeEventListener('click', onConfirm); cancelBtn.removeEventListener('click', onCancel); _closeModal(m); };
                    confirmBtn.addEventListener('click', onConfirm); cancelBtn.addEventListener('click', onCancel); _openModal(m);
                });
            }
            function insertTextAtCursor(textarea, text) { const start = textarea.selectionStart; textarea.value = textarea.value.substring(0, start) + text + textarea.value.substring(textarea.selectionEnd); textarea.selectionEnd = start + text.length; }
            function serializeEditorContent() { return dom.templateContentTextarea.value; }
            function updateFormVisibility() { 
                const isMovement = dom.mainIssueInput.value.trim().toLowerCase() === 'movement'; 
                dom.customerTemplateFields.classList.toggle('hidden', !dom.sendToCustomerCheckbox.checked); 
                dom.labelNameInput.classList.toggle('hidden', !dom.addLabelReminderCheckbox.checked); 
                dom.optionalFieldNameInput.classList.toggle('hidden', !dom.addOptionalFieldCheckbox.checked); 
                dom.internalCommentFields.classList.toggle('hidden', !isMovement); 
                dom.internalCommentInputContainer.classList.toggle('hidden', !dom.addInternalCommentCheckbox.checked || !isMovement); 
                dom.movementGuideEditor.classList.toggle('hidden', !isMovement);
                dom.followUpGuideEditor.classList.toggle('hidden', !dom.addFollowUpCheckbox.checked);
            }

            initializeApp();
        });
    </script>
