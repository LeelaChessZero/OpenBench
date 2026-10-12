// The existing spsa_inputs textarea remains the only submitted field.
const SPSA_FIELDS = ['name', 'type', 'start', 'min', 'max', 'c_end', 'r_end'];

function parse_spsa_text(text) {
    const rows = [];

    for (const [index, line] of text.split(/\r?\n/).entries()) {
        if (!line.trim())
            continue;

        const values = line.split(',').map(value => value.trim());
        if (values.length != SPSA_FIELDS.length)
            return { error: `Line ${index + 1} must have seven comma-separated fields.` };
        if (values[1] != 'int' && values[1] != 'float')
            return { error: `Line ${index + 1}: type must be int or float.` };

        rows.push(values);
    }

    return { rows: rows };
}

function add_spsa_row(values = ['', 'float', '', '', '', '', '']) {
    const row = document.createElement('tr');

    for (const [index, field] of SPSA_FIELDS.entries()) {
        const cell = document.createElement('td');
        let control;

        if (field == 'type') {
            control = document.createElement('select');
            for (const type of ['float', 'int']) {
                const option = document.createElement('option');
                option.value = option.text = type;
                control.add(option);
            }
        } else {
            control = document.createElement('input');
            control.type = 'text';
            if (field != 'name')
                control.inputMode = 'decimal';
        }

        control.dataset.field = field;
        control.setAttribute('aria-label', `${field.replace('_', ' ')} for parameter ${document.getElementById('spsa-rows').rows.length + 1}`);
        control.value = values[index];
        cell.appendChild(control);
        row.appendChild(cell);
    }

    const action = document.createElement('td');
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'anchorbutton btn-red spsa-remove-row';
    remove.textContent = 'Delete';
    remove.setAttribute('aria-label', 'Delete parameter');
    action.appendChild(remove);
    row.appendChild(action);

    document.getElementById('spsa-rows').appendChild(row);
    return row;
}

function spsa_row_values(row) {
    return SPSA_FIELDS.map(field => row.querySelector(`[data-field="${field}"]`).value.trim());
}

function sync_spsa_text() {
    const rows = Array.from(document.getElementById('spsa-rows').rows);
    const empty = rows.length == 1 && spsa_row_values(rows[0]).every((value, index) =>
        value == '' || (index == 1 && value == 'float'));
    document.getElementById('spsa_inputs').value = empty ? '' : rows
        .map(row => spsa_row_values(row).join(', ')).join('\n');
}

function show_spsa_errors(errors) {
    const message = document.getElementById('spsa-editor-errors');
    message.textContent = errors.join('\n');
    message.hidden = errors.length == 0;
}

function validate_spsa_rows() {
    const rows = Array.from(document.getElementById('spsa-rows').rows);
    const errors = [];
    const names = new Set();

    for (const [index, row] of rows.entries()) {
        const rowValues = spsa_row_values(row);
        const values = Object.fromEntries(SPSA_FIELDS.map((field, i) => [field, rowValues[i]]));
        const controls = Object.fromEntries(SPSA_FIELDS.map(field => [field, row.querySelector(`[data-field="${field}"]`)]));
        for (const control of Object.values(controls))
            control.removeAttribute('aria-invalid');

        const invalid = (field, message) => {
            controls[field].setAttribute('aria-invalid', 'true');
            errors.push(`Row ${index + 1}: ${message}`);
        };

        if (!values.name || values.name.includes(','))
            invalid('name', 'name is required and cannot contain a comma.');
        else if (names.has(values.name))
            invalid('name', 'name is duplicated.');
        names.add(values.name);

        const numbers = {};
        const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
        for (const field of ['start', 'min', 'max', 'c_end', 'r_end']) {
            numbers[field] = decimal.test(values[field]) ? Number(values[field]) : NaN;
            if (!Number.isFinite(numbers[field]))
                invalid(field, `${field.replace('_', ' ')} must be a number.`);
        }

        if (Number.isFinite(numbers.min) && Number.isFinite(numbers.max) && numbers.min > numbers.max)
            invalid('max', 'max must be at least min.');
        if (Number.isFinite(numbers.start) && Number.isFinite(numbers.min) && Number.isFinite(numbers.max)
                && (numbers.start < numbers.min || numbers.start > numbers.max))
            invalid('start', 'start must be within min and max.');
        if (values.type == 'float' && Number.isFinite(numbers.c_end) && numbers.c_end <= 0)
            invalid('c_end', 'C end must be greater than zero for floats.');
        if (Number.isFinite(numbers.r_end) && numbers.r_end <= 0)
            invalid('r_end', 'R end must be greater than zero.');
    }

    if (!rows.length)
        errors.push('Add at least one parameter.');

    show_spsa_errors(errors);
    return errors.length == 0;
}

function init_spsa_editor() {
    const editor = document.getElementById('spsa-editor');
    const rows = document.getElementById('spsa-rows');
    const raw = document.getElementById('spsa_inputs');
    const tableTab = document.getElementById('spsa-table-tab');
    const textTab = document.getElementById('spsa-text-tab');
    const tablePanel = document.getElementById('spsa-table-panel');
    const textPanel = document.getElementById('spsa-text-panel');
    let view = 'text';

    function show_table() {
        const parsed = parse_spsa_text(raw.value);
        if (parsed.error) {
            show_spsa_errors([parsed.error]);
            raw.focus();
            return;
        }

        rows.replaceChildren();
        for (const values of parsed.rows)
            add_spsa_row(values);
        if (!parsed.rows.length)
            add_spsa_row();

        tablePanel.hidden = false;
        textPanel.hidden = true;
        tableTab.setAttribute('aria-pressed', 'true');
        textTab.setAttribute('aria-pressed', 'false');
        view = 'table';
        if (parsed.rows.length)
            validate_spsa_rows();
        else
            show_spsa_errors([]);
    }

    function show_text() {
        sync_spsa_text();
        tablePanel.hidden = true;
        textPanel.hidden = false;
        tableTab.setAttribute('aria-pressed', 'false');
        textTab.setAttribute('aria-pressed', 'true');
        show_spsa_errors([]);
        view = 'text';
    }

    tableTab.addEventListener('click', show_table);
    textTab.addEventListener('click', show_text);
    document.getElementById('spsa-add-row').addEventListener('click', () => {
        add_spsa_row().querySelector('[data-field="name"]').focus();
        sync_spsa_text();
    });
    rows.addEventListener('click', event => {
        if (!event.target.classList.contains('spsa-remove-row'))
            return;
        event.target.closest('tr').remove();
        sync_spsa_text();
        if (!document.getElementById('spsa-editor-errors').hidden)
            validate_spsa_rows();
    });
    for (const eventName of ['input', 'change']) {
        rows.addEventListener(eventName, () => {
            sync_spsa_text();
            if (!document.getElementById('spsa-editor-errors').hidden)
                validate_spsa_rows();
        });
    }
    raw.addEventListener('input', () => show_spsa_errors([]));

    editor.closest('form').addEventListener('submit', event => {
        if (view == 'text') {
            const parsed = parse_spsa_text(raw.value);
            if (parsed.error) {
                show_spsa_errors([parsed.error]);
                event.preventDefault();
                raw.focus();
                return;
            }
            rows.replaceChildren();
            for (const values of parsed.rows)
                add_spsa_row(values);
        } else {
            sync_spsa_text();
        }

        if (!validate_spsa_rows()) {
            event.preventDefault();
            if (view == 'table')
                rows.querySelector('[aria-invalid="true"]')?.focus();
            else
                raw.focus();
        } else if (view == 'text') {
            sync_spsa_text();
        }
    });

    show_table();
}
