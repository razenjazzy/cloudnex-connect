from odoo import models


class StockPicking(models.Model):
    _inherit = "stock.picking"

    def write(self, vals):
        res = super().write(vals)
        if vals.get("state") != "done":
            return res
        Notify = self.env["cloudnex.connect.notify"].sudo()
        SaleOrder = self.env["sale.order"]
        for picking in self.filtered(lambda p: p.picking_type_code == "outgoing" and p.origin):
            order = SaleOrder.search([("name", "=", picking.origin.strip())], limit=1)
            if order:
                Notify.post_event("picking.done", order.id)
        return res
