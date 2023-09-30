import {useEffect, useState} from 'react';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import {DateCalendar} from '@mui/x-date-pickers/DateCalendar';
import dayjs, {Dayjs} from 'dayjs';


export default function Cal() {
    const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);

    useEffect(() => {
        // Parse the URL to extract the date
        const urlParts = window.location.pathname.split('/');
        if (urlParts.length >= 4) {
            const year = parseInt(urlParts[2], 10);
            const month = parseInt(urlParts[3], 10);
            const day = parseInt(urlParts[4], 10);

            if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
                // @ts-ignore
                const dateFromURL = dayjs([year, month, day]);
                setSelectedDate(dateFromURL);
            }
        }
    }, []);

    // @ts-ignore
    const handleDateChange = (newDate) => {
        const formattedDate = dayjs(newDate).format('YYYY-MM-DD');
        setSelectedDate(dayjs(formattedDate));

        const formattedDateWithSlashes = formattedDate.replace(/-/g, '/');
        window.location.href = `/posts/${formattedDateWithSlashes}`;
    }

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DateCalendar
                onChange={handleDateChange} // Attach the callback function
                value={selectedDate} // Set the selected date (for controlled component)
            />
        </LocalizationProvider>
    );
}
