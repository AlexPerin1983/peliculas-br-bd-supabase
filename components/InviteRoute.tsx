import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import InviteRegister from './InviteRegister';

export default function InviteRoute() {
    return (
        <BrowserRouter>
            <InviteRegister />
        </BrowserRouter>
    );
}
