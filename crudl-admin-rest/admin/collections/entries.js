import { formatDate, formatStringToDate } from '../utils'

//-------------------------------------------------------------------
var listView = {
    path: 'entries',
    title: 'Blog Entries',
    actions: {
        list: function (req, connectors) {
            return connectors.entries.read(req)
            .then(res => {
                /* counting the links requires an additional API call per row. please note that the
                number of links could be added at the database level, removing this additional call. */
                let promises = res.data.map(item => connectors.links.read(req.filter('entry', item._id)))
                return Promise.all(promises)
                .then(item_entrylinks => {
                    return res.set('data', res.data.map((item, index) => {
                        item.is_owner = req.authInfo.user == item.owner
                        item.counter_tags = item.tags.length
                        item.counter_links = item_entrylinks[index].data.length
                        return item
                    }))
                })
            })
        }
    },
    normalize: (list) => list.map(item => {
        item.date = formatStringToDate(item.date)
        return item
    })
}

listView.fields = [
    {
        name: 'section',
        key: 'section.name',
        label: 'Section',
        sortable: true,
    },
    {
        name: 'category',
        key: 'category.name',
        defaultValue: '',  // defaultValue makes sense if the key is not given
        label: 'Category',
        sortable: true,
    },
    {
        name: 'title',
        label: 'Title',
        main: true,
        sortable: true,
    },
    {
        name: 'status',
        label: 'Status',
        sortable: true,
    },
    {
        name: 'date',
        label: 'Date',
        sortable: true,
        sorted: 'descending',
        sortpriority: '2',
    },
    {
        name: 'sticky',
        label: 'Sticky',
        render: 'boolean',
        sortable: true,
        sorted: 'descending',
        sortpriority: '1',
    },
    {
        name: 'is_owner',
        label: 'Owner',
        render: 'boolean',
    },
    {
        name: 'counter_links',
        label: 'No. Links',
        render: 'number',
    },
    {
        name: 'counter_tags',
        label: 'No. Tags',
        render: 'number',
    },
]

listView.filters = {
    fields: [
        {
            name: 'section',
            label: 'Section',
            field: 'Select',
            actions: {
                asyncProps: (req, connectors) => connectors.sections_options.read(req),
            },
        },
        {
            name: 'category',
            label: 'Category',
            field: 'Select',
            watch: [
                {
                    for: 'section',
                    setValue: '',
                    setProps: section => ({
                        readOnly: !section,
                        helpText: !section ? 'In order to select a category, you have to select a section first' : 'Select a category',
                    }),
                }
            ],
            actions: {
                asyncProps: (req, connectors) => {
                    return connectors.categories_options.read(req)
                    // console.log(req.context)
                    // if (!req.context.section) {
                    //     return Promise.resolve({data: []})
                    // } else {
                    //     return connectors.categories_options.read(req)
                    // }
                }
            },
        },
        {
            name: 'status',
            label: 'Status',
            field: 'Select',
            props: {
                options: [
                    {value: '0', label: 'Draft'},
                    {value: '1', label: 'Online'}
                ]
            },
        },
        {
            name: 'date_gt',
            label: 'Published after',
            field: 'Date',
            /* simple date validation (please note that this is just a showcase,
            we know that it does not check for real dates) */
            validate: (value, allValues) => {
                const dateReg = /^\d{4}-\d{2}-\d{2}$/
                if (value && !value.match(dateReg)) {
                    return 'Please enter a date (YYYY-MM-DD).'
                }
            }
        },
        {
            name: 'sticky',
            label: 'Sticky',
            field: 'Select',
            props: {
                options: [
                    {value: 'true', label: 'True'},
                    {value: 'false', label: 'False'}
                ]
            },
            props: {
                helpText: 'Note: We use Select in order to distinguish false and none.'
            }
        }
    ]
}

listView.search = {
    name: 'search',
}

//-------------------------------------------------------------------
var changeView = {
    path: 'entries/:_id',
    title: 'Blog Entry',
    actions: {
        get: function (req, connectors) { return connectors.entry(req.id).read(req) },
        delete: function (req, connectors) { return connectors.entry(req.id).delete(req) },
        save: function (req, connectors) { return connectors.entry(req.id).update(req) },
    },
    normalize: (get) => {
        get.date = formatStringToDate(get.date)
        return get
    }
}

changeView.fieldsets = [
    {
        fields: [
            {
                name: 'id',
                field: 'hidden',
            },
            {
                name: 'title',
                label: 'Title',
                field: 'Text',
                required: true,
            },
            {
                name: 'status',
                label: 'Status',
                field: 'Select',
                required: true,
                initialValue: '0',
                /* set options manually */
                props: {
                    options: [
                        {value: '0', label: 'Draft'},
                        {value: '1', label: 'Online'}
                    ]
                },
            },
            {
                name: 'section',
                label: 'Section',
                field: 'Select',
                /* we set required to false, although this field is actually
                required with the API. */
                required: false,
                props: {
                    helpText: 'Select a section'
                },
                /* get options via an API call: instead we could use
                connectors.sections_options (see listView.filters) */
                actions: {
                    asyncProps: (req, connectors) => connectors.sections.read(req)
                    .then(res => res.set('data', {
                        options: res.data.map(section => ({
                            value: section._id,
                            label: section.name,
                        }))
                    }))
                },
            },
            {
                name: 'category',
                label: 'Category',
                field: 'Autocomplete',
                required: false,
                props: {
                    showAll: true,
                    helpText: 'Select a category',
                },
                /* this field depends on section (so we add a watch function in
                order to react to any changes on the field section). */
                watch: [
                    {
                        for: 'section',
                        setValue: '',
                        setProps: section => ({
                            readOnly: !section,
                            helpText: !section ? 'In order to select a category, you have to select a section first' : 'Select a category',
                        }),
                    }
                ],
                actions: {
                    select: (req, connectors) => {
                        return Promise.all(req.data.selection.map(item => {
                            return connectors.category(item.value).read(req)
                            .then(res => res.set('data', {
                                value: res.data._id,
                                label: res.data.name,
                            }))
                        }))
                    },
                    search: (req, connectors) => {
                        if (!req.context.section) {
                            return Promise.resolve({data: []})
                        } else {
                            return connectors.categories.read(req
                                .filter('name', req.data.query)
                                .filter('section', req.context.section))
                            .then(res => res.set('data', res.data.map(d => ({
                                value: d._id,
                                label: `<b>${d.name}</b> (${d.slug})`,
                            }))))
                        }
                    },
                },
            },
        ],
    },
    {
        title: 'Content',
        expanded: true,
        fields: [
            {
                name: 'date',
                label: 'Date',
                field: 'Date',
                required: true,
                initialValue: () => formatDate(new Date()),
                props: {
                    formatDate: formatDate
                }
            },
            {
                name: 'sticky',
                label: 'Sticky',
                field: 'Checkbox',
            },
            {
                name: 'summary',
                label: 'Summary',
                field: 'Textarea',
                validate: (value, allValues) => {
                    if (!value && allValues.status == '1') {
                        return 'The summary is required with status "Online".'
                    }
                }
            },
            {
                name: 'body',
                label: 'Body',
                field: 'Textarea',
                validate: (value, allValues) => {
                    if (!value && allValues.status == '1') {
                        return 'The summary is required with status "Online".'
                    }
                }
            },
            {
                name: 'tags',
                label: 'Tags',
                field: 'AutocompleteMultiple',
                required: false,
                props: {
                    showAll: false,
                    helpText: 'Select a tag',
                },
                actions: {
                    search: (req, connectors) => {
                        return connectors.tags_options.read(req.filter('name', req.data.query.toLowerCase()))
                        .then(res => res.set('data', res.data.options))
                    },
                    select: (req, connectors) => {
                        return Promise.all(req.data.selection.map(item => {
                            return connectors.tag(item.value).read(req)
                            .then(res => res.set('data', {
                                value: res.data._id,
                                label: res.data.name,
                            }))
                        }))
                    },
                },
            }
        ]
    },
    {
        title: 'Internal',
        expanded: false,
        fields: [
            {
                name: 'createdate',
                label: 'Date (Create)',
                field: 'Datetime',
                readOnly: true
            },
            {
                name: 'updatedate',
                label: 'Date (Update)',
                field: 'Datetime',
                readOnly: true
            },
            {
                name: 'owner',
                key: 'owner_username',
                label: 'Owner',
                field: 'String',
                readOnly: true
            },
        ]
    }
]

changeView.tabs = [
    {
        title: 'Links',
        actions: {
            list: (req, connectors) => connectors.links.read(req.filter('entry', req.id)),
            add: (req, connectors) => connectors.links.create(req),
            save: (req, connectors) => connectors.link(req.data.id).update(req),
            delete: (req, connectors) => connectors.link(req.data.id).delete(req)
        },
        itemTitle: '{url}',
        fields: [
            {
                name: 'url',
                label: 'URL',
                field: 'URL',
                props: {
                    link: true,
                },
            },
            {
                name: 'title',
                label: 'Title',
                field: 'String',
            },
            {
                name: 'id',
                field: 'hidden',
            },
            {
                name: 'entry',
                field: 'hidden',
                initialValue: (context) => context.data._id,
            },
        ],
    },
]

//-------------------------------------------------------------------
var addView = {
    path: 'entries/new',
    title: 'New Blog Entry',
    fieldsets: changeView.fieldsets,
    actions: {
        add: function (req, connectors) { return connectors.entries.create(req) },
    },
}

//-------------------------------------------------------------------
module.exports = {
    listView,
    addView,
    changeView,
}
