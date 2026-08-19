
document.addEventListener('DOMContentLoaded', () => {
    const app = {
        // DOM Elements
        elements: {
            appContainer: document.getElementById('app'),
            formCount: document.getElementById('form-count'),
            formListView: document.getElementById('form-list-view'),
            formListContainer: document.getElementById('form-list-container'),
            formDisplayView: document.getElementById('form-display-view'),
        },

        // Application State
        state: {
            templates: [],
            categoryTitles: {},
            activeForm: null,
        },

        // Initialize the application
        init() {
            this.fetchData();
            this.addEventListeners();
        },

        // Fetch all necessary data (manifests)
        async fetchData() {
            try {
                // Fetch both manifests in parallel
                const [templatesRes, specRes] = await Promise.all([
                    fetch('templates/manifest.json'),
                    fetch('spec/templates.manifest.json') 
                ]);

                if (!templatesRes.ok) throw new Error('Failed to load templates manifest');
                if (!specRes.ok) throw new Error('Failed to load spec manifest');

                this.state.templates = await templatesRes.json();
                const specManifest = await specRes.json();
                
                // Extract category titles for display
                for (const key in specManifest.categories) {
                    this.state.categoryTitles[key] = specManifest.categories[key].ar;
                }

                this.renderFormList();
            } catch (error) {
                console.error('Error fetching data:', error);
                this.elements.formListContainer.innerHTML = '<li><p>Error loading forms.</p></li>';
            }
        },
        
        // Render the list of forms, grouped by category
        renderFormList() {
            this.elements.formListContainer.innerHTML = ''; // Clear existing list
            this.elements.formCount.textContent = `${this.state.templates.length} نموذج متاح`;

            const sourceMap = {
                "original_html_conversion": " (أصلي)",
                "new_generated": " (جديد)",
                "scraped_from_web": " (مستخلص)"
            };

            // Group templates by category
            const groupedTemplates = this.state.templates.reduce((acc, template) => {
                const category = template.category || 'other';
                if (!acc[category]) {
                    acc[category] = [];
                }
                acc[category].push(template);
                return acc;
            }, {});

            // Render each category and its templates
            for (const categoryId in groupedTemplates) {
                const categoryTitle = this.state.categoryTitles[categoryId] || categoryId;
                
                const categoryHeader = document.createElement('h2');
                categoryHeader.className = 'category-title';
                categoryHeader.textContent = categoryTitle;
                this.elements.formListContainer.appendChild(categoryHeader);

                const templateList = document.createElement('ul');
                templateList.className = 'form-list-category';
                
                groupedTemplates[categoryId].forEach(template => {
                    const li = document.createElement('li');
                    const fieldCountText = template.field_count ? `(${template.field_count} حقل)` : '';
                    
                    const sourceText = sourceMap[template.source] || '';
                    li.innerHTML = `
                        <a href="#" data-template-id="${template.id}">${template.title}</a>
                        <span class="field-count">${fieldCountText}</span>
                        <span class="template-source">${sourceText}</span>
                    `;
                    templateList.appendChild(li);
                });
                this.elements.formListContainer.appendChild(templateList);
            }
        },

        // Add all necessary event listeners
        addEventListeners() {
            // Use event delegation for form list clicks
            this.elements.formListContainer.addEventListener('click', (e) => {
                if (e.target.tagName === 'A') {
                    e.preventDefault();
                    const templateId = e.target.dataset.templateId;
                    if (templateId) {
                        const template = this.state.templates.find(t => t.id === templateId);
                        if (template) {
                            this.loadAndRenderForm(template);
                        }
                    }
                }
            });
        },

        // Fetch a specific form's JSON and render it
        async loadAndRenderForm(template) {
            try {
                const response = await fetch(`templates/${template.file}`);
                if (!response.ok) throw new Error(`Failed to load template: ${template.file}`);
                const formData = await response.json();
                this.state.activeForm = formData;
                this.renderForm(formData);
            } catch (error) {
                console.error('Error loading form:', error);
            }
        },

        // Render the single form view
        renderForm(data) {
            // Clear previous form and build the new one
            this.elements.formDisplayView.innerHTML = '';

            const title = document.createElement('h1');
            title.className = 'doc-title';
            title.textContent = data.title;

            const form = document.createElement('form');
            form.id = 'doc-form';
            form.autocomplete = 'off';

            const docBody = document.createElement('div');
            docBody.className = 'doc-body';

            // Build the form structure
            data.structure.forEach(item => {
                if (item.type === 'paragraph') {
                    const p = document.createElement('p');
                    p.className = 'doc-line';
                    p.dir = 'rtl';
                    item.content.forEach(part => {
                        if (part.type === 'text') {
                            p.appendChild(document.createTextNode(part.value + ' '));
                        } else if (part.type === 'field') {
                            const fieldDef = data.fields.find(f => f.id === part.id);
                            if (fieldDef) {
                                const input = document.createElement('input');
                                input.type = fieldDef.type || 'text';
                                input.id = fieldDef.id;
                                input.name = fieldDef.id;
                                input.className = 'field';
                                if (fieldDef.type === 'date') {
                                    input.className += ' date-field';
                                }
                                if (fieldDef.label) {
                                    input.placeholder = fieldDef.label;
                                }
                                p.appendChild(input);
                            }
                        }
                    });
                    docBody.appendChild(p);
                } else if (item.type === 'break') {
                    docBody.appendChild(document.createElement('br'));
                }
            });

            // Actions (buttons)
            const actions = document.createElement('div');
            actions.className = 'actions';
            actions.innerHTML = `
                <button type="button" id="export-btn">تصدير كنص</button>
                <button type="button" id="print-btn">طباعة</button>
                <a href="#" id="back-btn">← العودة للقائمة</a>
            `;
            
            form.appendChild(docBody);
            form.appendChild(actions);
            
            this.elements.formDisplayView.appendChild(title);
            this.elements.formDisplayView.appendChild(form);

            // Add event listeners for the new buttons
            document.getElementById('export-btn').addEventListener('click', () => this.exportForm());
            document.getElementById('print-btn').addEventListener('click', () => window.print());
            document.getElementById('back-btn').addEventListener('click', (e) => {
                e.preventDefault();
                this.showListView();
            });

            // Switch views
            this.showFormView();
        },

        // Export filled form data as a text file
        exportForm() {
            if (!this.state.activeForm) return;

            const data = this.state.activeForm;
            let out = '';
            data.fields.forEach(f => {
                const el = document.getElementById(f.id);
                const val = el ? (el.type === 'checkbox' ? (el.checked ? '✓' : '☐') : el.value) : '';
                out += (f.label || f.id) + ': ' + val + '\n';
            });

            const blob = new Blob([out], { type: 'text/plain;charset=utf-8' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${data.id}-filled.txt`;
            a.click();
        },

        // Show the form display and hide the list
        showFormView() {
            this.elements.formListView.style.display = 'none';
            this.elements.formDisplayView.style.display = 'block';
        },

        // Show the list and hide the form display
        showListView() {
            this.state.activeForm = null;
            this.elements.formDisplayView.style.display = 'none';
            this.elements.formListView.style.display = 'block';
        }
    };

    // Start the app
    app.init();
});
