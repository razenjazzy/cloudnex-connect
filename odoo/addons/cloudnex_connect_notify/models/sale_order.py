from odoo import models


class SaleOrder(models.Model):
    _inherit = "sale.order"

    def cloudnex_notify_approval(self):
        """Bind an Odoo automated action (approval stage write) to this method."""
        Notify = self.env["cloudnex.connect.notify"].sudo()
        for order in self:
            Notify.post_event("approval.stage", order.id)
        return True
